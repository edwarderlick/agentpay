"""Studio Next settlement probe.

Run with:
  gltest tests/integration/test_settlement_probe.py -v -s --network studio_devnet
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest
from gltest import get_accounts, get_contract_factory, get_default_account, get_gl_client
from gltest.assertions import tx_execution_failed, tx_execution_succeeded
from gltest.helpers import load_fixture
from gltest.types import ProtocolTransactionStatus

from studio_evidence import (
    explorer_address,
    native_balance,
    receipt_evidence,
    transaction_fee_preset,
    wait_child_receipts,
    write_fee_preset,
)


pytestmark = pytest.mark.integration

CREDIT = 10**16  # 0.01 test-GEN
UNUSED = 10**16
FUND_AMOUNT = 10**21
WAIT = {"wait_until": "finalized", "wait_interval": 4000, "wait_retries": 90}
FINALIZED = ProtocolTransactionStatus.FINALIZED


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
def deploy_probe():
    accounts = get_accounts()
    depositor = get_default_account()
    recipient = accounts[1]
    _fund([depositor.address, recipient.address])

    probe_factory = get_contract_factory("SettlementProbe")
    sink_factory = get_contract_factory("RejectingSink")

    probe = probe_factory.deploy(fees=_fees(), wait_until="finalized")
    sink = sink_factory.deploy(fees=_fees(), wait_until="finalized")

    print(
        "[evidence] probe",
        probe.address,
        explorer_address(probe.address),
    )
    print(
        "[evidence] sink",
        sink.address,
        explorer_address(sink.address),
    )
    return {
        "probe": probe,
        "sink": sink,
        "depositor": depositor,
        "recipient": recipient,
    }


def test_studio_next_native_transfer_and_refund():
    ctx = load_fixture(deploy_probe)
    probe = ctx["probe"]
    sink = ctx["sink"]
    depositor = ctx["depositor"]
    recipient = ctx["recipient"]
    recipient_probe = probe.connect(recipient)

    chain = get_gl_client().chain
    assert chain.id == 61997, f"expected Studio Next 61997, got {chain.id}"
    rpc = chain.rpc_urls["default"]["http"][0]
    assert "studio-next.genlayer.com" in rpc or "studio-dev.genlayer.com" in rpc
    assert chain.id != 61999

    before_accounting = probe.get_accounting(args=[]).call()
    before_contract = native_balance(probe.address)
    before_recipient = native_balance(recipient.address)
    before_depositor = native_balance(depositor.address)
    print(
        "[evidence] before",
        {
            "accounting": before_accounting,
            "contract_native": before_contract,
            "recipient_native": before_recipient,
            "depositor_native": before_depositor,
        },
    )

    deposit_credit = probe.deposit_credit(args=[recipient.address]).transact(
        value=CREDIT,
        fees=_fees(probe, "deposit_credit", [recipient.address], value=CREDIT),
        **WAIT,
    )
    assert tx_execution_succeeded(deposit_credit)
    receipt_evidence("deposit_credit", deposit_credit)

    deposit_unused = probe.deposit_unused(args=[]).transact(
        value=UNUSED,
        fees=_fees(probe, "deposit_unused", [], value=UNUSED),
        **WAIT,
    )
    assert tx_execution_succeeded(deposit_unused)
    receipt_evidence("deposit_unused", deposit_unused)

    after_deposit_accounting = probe.get_accounting(args=[]).call()
    after_deposit_wallet = probe.get_wallet(args=[recipient.address]).call()
    after_deposit_unused = probe.get_unused(args=[depositor.address]).call()
    after_deposit_contract = native_balance(probe.address)
    after_deposit_recipient = native_balance(recipient.address)
    print(
        "[evidence] after deposit",
        {
            "accounting": after_deposit_accounting,
            "recipient_wallet": after_deposit_wallet,
            "depositor_unused": after_deposit_unused,
            "contract_native": after_deposit_contract,
            "recipient_native": after_deposit_recipient,
        },
    )
    assert int(after_deposit_accounting["total_credits"]) == CREDIT
    assert int(after_deposit_accounting["total_unused"]) == UNUSED
    assert int(after_deposit_wallet["credit"]) == CREDIT
    assert int(after_deposit_unused) == UNUSED
    assert after_deposit_contract - before_contract == CREDIT + UNUSED
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

    withdraw = recipient_probe.withdraw(args=[]).transact(
        fees=_fees(probe, "withdraw", [], account=recipient),
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=FINALIZED,
        **WAIT,
    )
    assert tx_execution_succeeded(withdraw)
    withdraw_ev = receipt_evidence("withdraw", withdraw)
    children = wait_child_receipts(withdraw)

    after_withdraw_accounting = probe.get_accounting(args=[]).call()
    after_withdraw_wallet = probe.get_wallet(args=[recipient.address]).call()
    after_withdraw_contract = native_balance(probe.address)
    after_withdraw_recipient = native_balance(recipient.address)
    print(
        "[evidence] after withdraw",
        {
            "accounting": after_withdraw_accounting,
            "recipient_wallet": after_withdraw_wallet,
            "contract_native": after_withdraw_contract,
            "recipient_native": after_withdraw_recipient,
            "children": children,
        },
    )

    recipient_gain = after_withdraw_recipient - after_deposit_recipient
    contract_drop = after_deposit_contract - after_withdraw_contract
    print(
        "[evidence] transfer deltas",
        {
            "recipient_gain": recipient_gain,
            "contract_drop": contract_drop,
            "expected": CREDIT,
        },
    )

    if recipient_gain != CREDIT:
        pytest.fail(
            "Studio Next did not deliver native GEN to the credited wallet. "
            f"parent={withdraw_ev} children={children} "
            f"recipient_gain={recipient_gain} contract_drop={contract_drop} "
            f"credit_after={after_withdraw_wallet}"
        )

    assert int(after_withdraw_wallet["credit"]) == 0
    assert int(after_withdraw_wallet["in_flight"]) == CREDIT
    assert contract_drop == CREDIT

    reclaim = probe.reclaim(args=[]).transact(
        fees=_fees(probe, "reclaim", []),
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=FINALIZED,
        **WAIT,
    )
    assert tx_execution_succeeded(reclaim)
    reclaim_ev = receipt_evidence("reclaim", reclaim)
    reclaim_children = wait_child_receipts(reclaim)

    after_reclaim_accounting = probe.get_accounting(args=[]).call()
    after_reclaim_unused = probe.get_unused(args=[depositor.address]).call()
    after_reclaim_contract = native_balance(probe.address)
    after_reclaim_depositor = native_balance(depositor.address)
    print(
        "[evidence] after reclaim",
        {
            "accounting": after_reclaim_accounting,
            "depositor_unused": after_reclaim_unused,
            "contract_native": after_reclaim_contract,
            "depositor_native": after_reclaim_depositor,
            "children": reclaim_children,
        },
    )
    unused_drop = after_withdraw_contract - after_reclaim_contract
    if unused_drop != UNUSED:
        pytest.fail(
            "Studio Next did not refund unused GEN from the contract. "
            f"parent={reclaim_ev} children={reclaim_children} "
            f"contract_drop={unused_drop} unused_after={after_reclaim_unused}"
        )
    assert int(after_reclaim_unused) == 0

    second_credit = probe.deposit_credit(args=[recipient.address]).transact(
        value=CREDIT,
        fees=_fees(probe, "deposit_credit", [recipient.address], value=CREDIT),
        **WAIT,
    )
    assert tx_execution_succeeded(second_credit)
    receipt_evidence("deposit_credit_for_failed_path", second_credit)

    before_fail_credit = int(probe.get_credit(args=[recipient.address]).call())
    before_fail_contract = native_balance(probe.address)
    before_fail_sink = native_balance(sink.address)
    assert before_fail_credit == CREDIT

    failed = recipient_probe.attempt_withdraw_to(args=[sink.address]).transact(
        fees=_fees(
            probe, "attempt_withdraw_to", [sink.address], account=recipient
        ),
        wait_triggered_transactions=True,
        wait_triggered_transactions_status=FINALIZED,
        **WAIT,
    )
    failed_ev = receipt_evidence("attempt_withdraw_to_sink", failed)
    failed_children = wait_child_receipts(failed)

    after_fail_wallet = probe.get_wallet(args=[recipient.address]).call()
    after_fail_contract = native_balance(probe.address)
    after_fail_sink = native_balance(sink.address)
    print(
        "[evidence] failed transfer",
        {
            "parent_succeeded": bool(tx_execution_succeeded(failed)),
            "parent_failed": bool(tx_execution_failed(failed)),
            "wallet": after_fail_wallet,
            "contract_native": after_fail_contract,
            "sink_native": after_fail_sink,
            "children": failed_children,
            "parent": failed_ev,
        },
    )

    sink_gain = after_fail_sink - before_fail_sink
    if tx_execution_failed(failed):
        assert int(after_fail_wallet["credit"]) == CREDIT
        assert sink_gain == 0
        print("[evidence] parent rolled back; credit retained")
    elif tx_execution_succeeded(failed) and sink_gain == 0:
        print(
            "[evidence] parent finalized but sink received no GEN; "
            "credit must not be treated as paid"
        )
        assert int(after_fail_wallet["credit"]) == 0 or int(
            after_fail_wallet["in_flight"]
        ) >= CREDIT
        assert after_fail_contract >= before_fail_contract - CREDIT
    else:
        pytest.fail(
            "Unexpected sink transfer outcome: "
            f"sink_gain={sink_gain} parent={failed_ev} children={failed_children} "
            f"wallet={after_fail_wallet}"
        )
