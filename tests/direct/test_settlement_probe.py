"""Direct-mode tests for SettlementProbe accounting and access control.

Native GEN delivery is proven on Studio Next in the integration suite.
Direct mode does not fully execute `emit_transfer` child messages.
"""

from tests.direct.conftest import to_hex


CONTRACT = "contracts/settlement_probe.py"
DEPOSIT = 10**15


def _deal_value(vm, amount: int) -> None:
    addr = vm._contract_address
    vm.deal(addr, vm._balances.get(addr, 0) + amount)
    vm.value = amount


def _clear_value(vm) -> None:
    vm.value = 0


def test_deposit_records_credit_for_named_wallet(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    alice = to_hex(direct_alice)
    bob = to_hex(direct_bob)

    direct_vm.sender = direct_alice
    _deal_value(direct_vm, DEPOSIT)
    contract.deposit_credit(bob)
    _clear_value(direct_vm)

    assert contract.get_credit(bob) == DEPOSIT
    assert contract.get_credit(alice) == 0
    accounting = contract.get_accounting()
    assert accounting["total_credits"] == DEPOSIT
    assert accounting["uncommitted"] == DEPOSIT
    assert accounting["contract_balance"] == DEPOSIT


def test_zero_deposit_reverts(direct_vm, direct_deploy, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.value = 0
    with direct_vm.expect_revert("deposit must be positive"):
        contract.deposit_credit(to_hex(direct_bob))


def test_only_credited_wallet_can_withdraw(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    bob = to_hex(direct_bob)

    direct_vm.sender = direct_alice
    _deal_value(direct_vm, DEPOSIT)
    contract.deposit_credit(bob)
    _clear_value(direct_vm)

    with direct_vm.expect_revert("no withdrawable credit"):
        contract.withdraw()

    wallet = contract.get_wallet(bob)
    assert wallet["credit"] == DEPOSIT
    assert wallet["in_flight"] == 0


def test_depositor_reclaims_separate_unused_amount(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    alice = to_hex(direct_alice)
    bob = to_hex(direct_bob)

    direct_vm.sender = direct_alice
    _deal_value(direct_vm, DEPOSIT)
    contract.deposit_credit(bob)
    _deal_value(direct_vm, DEPOSIT * 2)
    contract.deposit_unused()
    _clear_value(direct_vm)

    assert contract.get_credit(bob) == DEPOSIT
    assert contract.get_unused(alice) == DEPOSIT * 2
    accounting = contract.get_accounting()
    assert accounting["total_credits"] == DEPOSIT
    assert accounting["total_unused"] == DEPOSIT * 2
    assert accounting["uncommitted"] == DEPOSIT * 3
    assert accounting["contract_balance"] == DEPOSIT * 3

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("no unused amount"):
        contract.reclaim()

    assert contract.get_unused(alice) == DEPOSIT * 2


def test_invalid_address_reverts(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    _deal_value(direct_vm, DEPOSIT)
    with direct_vm.expect_revert("invalid address"):
        contract.deposit_credit("not-an-address")
    _clear_value(direct_vm)


def test_withdraw_without_credit_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("no withdrawable credit"):
        contract.withdraw()


def test_insufficient_contract_balance_keeps_credit(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    bob = to_hex(direct_bob)

    direct_vm.sender = direct_alice
    _deal_value(direct_vm, DEPOSIT)
    contract.deposit_credit(bob)
    _clear_value(direct_vm)

    # Native backing was recorded by _deal_value. Drain it so emit cannot run.
    direct_vm.deal(direct_vm._contract_address, 0)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("insufficient contract balance"):
        contract.withdraw()

    assert contract.get_credit(bob) == DEPOSIT
    assert contract.get_in_flight(bob) == 0
