"""Studio Next EOA EmitExternalMessage probe.

Run with:
  gltest tests/integration/test_eoa_transfer_probe.py -v -s --network studio_devnet
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest
from gltest import get_accounts, get_contract_factory, get_default_account, get_gl_client
from gltest.assertions import tx_execution_failed, tx_execution_succeeded
from gltest.helpers import load_fixture

from studio_evidence import (
    explorer_address,
    native_balance,
    poll_native_deltas,
    receipt_evidence,
    sender_fee_spent,
    transaction_fee_preset,
    write_fee_preset,
)


pytestmark = pytest.mark.integration

CREDIT = 10**16  # 0.01 test-GEN
FUND_AMOUNT = 10**21
WAIT = {"wait_until": "finalized", "wait_interval": 4000, "wait_retries": 90}


def _fees(contract=None, method=None, args=None, value=0, account=None):
    if contract is not None and method is not None:
        try:
            return write_fee_preset(
                contract, method, args=args, value=value, account=account
            )
        except Exception as exc:
            print(f"[evidence] write fee estimate fell back: {exc}")
    return transaction_fee_preset()


def _fund(addresses):
    client = get_gl_client()
    for address in addresses:
        before = native_balance(address)
        if before >= FUND_AMOUNT // 2:
            print(f"[evidence] already funded {address}: {before}")
            continue
        tx = client.fund_account(address, FUND_AMOUNT)
        print(f"[evidence] fund {address} tx={tx} before={before}")


@pytest.mark.integration
def deploy_eoa_probe():
    accounts = get_accounts()
    depositor = get_default_account()
    recipient = accounts[1]
    _fund([depositor.address, recipient.address])

    factory = get_contract_factory("EoaTransferProbe")
    probe = factory.deploy(fees=_fees(), wait_until="finalized")
    print("[evidence] probe", probe.address, explorer_address(probe.address))
    return {"probe": probe, "depositor": depositor, "recipient": recipient}


def test_studio_next_eoa_external_transfer():
    ctx = load_fixture(deploy_eoa_probe)
    probe = ctx["probe"]
    depositor = ctx["depositor"]
    recipient = ctx["recipient"]
    recipient_probe = probe.connect(recipient)

    chain = get_gl_client().chain
    assert chain.id == 61997, f"expected Studio Next 61997, got {chain.id}"
    rpc = chain.rpc_urls["default"]["http"][0]
    assert "studio-next.genlayer.com" in rpc
    assert chain.id != 61999

    before_accounting = probe.get_accounting(args=[]).call()
    before_contract = native_balance(probe.address)
    before_recipient = native_balance(recipient.address)
    print(
        "[evidence] before",
        {
            "accounting": before_accounting,
            "contract_native": before_contract,
            "recipient_native": before_recipient,
            "depositor": depositor.address,
            "recipient": recipient.address,
        },
    )

    deposit = probe.deposit(args=[recipient.address]).transact(
        value=CREDIT,
        fees=_fees(probe, "deposit", [recipient.address], value=CREDIT),
        **WAIT,
    )
    assert tx_execution_succeeded(deposit)
    receipt_evidence("deposit", deposit)

    after_deposit_accounting = probe.get_accounting(args=[]).call()
    after_deposit_contract = native_balance(probe.address)
    after_deposit_recipient = native_balance(recipient.address)
    after_deposit_credit = int(probe.get_credit(args=[recipient.address]).call())
    print(
        "[evidence] after deposit",
        {
            "accounting": after_deposit_accounting,
            "contract_native": after_deposit_contract,
            "recipient_native": after_deposit_recipient,
            "credit": after_deposit_credit,
        },
    )
    assert after_deposit_credit == CREDIT
    assert int(after_deposit_accounting["total_credits"]) == CREDIT
    assert after_deposit_contract - before_contract == CREDIT
    assert after_deposit_recipient == before_recipient

    unauthorized = probe.withdraw(args=[]).transact(
        fees=_fees(probe, "withdraw", []),
        wait_until="decided",
        wait_interval=4000,
        wait_retries=60,
    )
    assert tx_execution_failed(unauthorized)
    receipt_evidence("unauthorized_withdraw", unauthorized)
    assert int(probe.get_credit(args=[recipient.address]).call()) == CREDIT

    accounts = get_accounts()
    empty_account = accounts[2] if len(accounts) > 2 else depositor
    if empty_account.address != depositor.address:
        _fund([empty_account.address])
    empty_probe = probe.connect(empty_account)
    no_credit = empty_probe.withdraw(args=[]).transact(
        fees=_fees(probe, "withdraw", [], account=empty_account),
        wait_until="decided",
        wait_interval=4000,
        wait_retries=60,
    )
    assert tx_execution_failed(no_credit)
    receipt_evidence("insufficient_credit", no_credit)
    assert int(probe.get_credit(args=[recipient.address]).call()) == CREDIT

    withdraw = recipient_probe.withdraw(args=[]).transact(
        fees=_fees(probe, "withdraw", [], account=recipient),
        **WAIT,
    )
    assert tx_execution_succeeded(withdraw)
    withdraw_ev = receipt_evidence("withdraw", withdraw)
    fee_spent = sender_fee_spent(withdraw)
    print("[evidence] recipient withdraw fee_spent", fee_spent)

    settled = poll_native_deltas(
        contract_address=probe.address,
        recipient_address=recipient.address,
        contract_before=after_deposit_contract,
        recipient_before=after_deposit_recipient,
        expected=CREDIT,
        recipient_fee=fee_spent,
        timeout_s=180,
        interval_s=4.0,
    )
    print("[evidence] settlement", settled)

    after_credit = int(probe.get_credit(args=[recipient.address]).call())
    after_accounting = probe.get_accounting(args=[]).call()
    print(
        "[evidence] after withdraw accounting",
        {"credit": after_credit, "accounting": after_accounting},
    )

    if not settled.get("settled"):
        pytest.fail(
            "Studio Next did not deliver native GEN via EmitExternalMessage. "
            f"parent={withdraw_ev} settlement={settled} credit_after={after_credit}"
        )

    assert after_credit == 0
    print("[evidence] PAID: contract dropped and recipient net rose by CREDIT")
