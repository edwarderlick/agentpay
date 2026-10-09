"""Direct-mode tests for EoaTransferProbe access control.

Native GEN delivery is proven only on Studio Next.
"""

from tests.direct.conftest import to_hex


CONTRACT = "contracts/eoa_transfer_probe.py"
DEPOSIT = 10**15


def _deal_value(vm, amount: int) -> None:
    addr = vm._contract_address
    vm.deal(addr, vm._balances.get(addr, 0) + amount)
    vm.value = amount


def _clear_value(vm) -> None:
    vm.value = 0


def test_deposit_records_credit(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    alice = to_hex(direct_alice)
    bob = to_hex(direct_bob)

    direct_vm.sender = direct_alice
    _deal_value(direct_vm, DEPOSIT)
    contract.deposit(bob)
    _clear_value(direct_vm)

    assert contract.get_credit(bob) == DEPOSIT
    assert contract.get_credit(alice) == 0
    assert contract.get_accounting()["total_credits"] == DEPOSIT


def test_zero_deposit_reverts(direct_vm, direct_deploy, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.value = 0
    with direct_vm.expect_revert("deposit must be positive"):
        contract.deposit(to_hex(direct_bob))


def test_unauthorized_withdraw_reverts(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    bob = to_hex(direct_bob)

    direct_vm.sender = direct_alice
    _deal_value(direct_vm, DEPOSIT)
    contract.deposit(bob)
    _clear_value(direct_vm)

    with direct_vm.expect_revert("insufficient credit"):
        contract.withdraw()
    assert contract.get_credit(bob) == DEPOSIT


def test_insufficient_credit_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("insufficient credit"):
        contract.withdraw()
