"""Helpers for Studio Next settlement evidence."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Optional

from gltest.clients import get_gl_client
from web3 import Web3

EVIDENCE_DIR = Path(__file__).resolve().parents[2] / "docs" / "evidence-matrix"
PRODUCT_ADDRESS = "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F"


EXPLORER = "https://explorer-studio-dev.genlayer.com"
FEE_ESTIMATE_OPTIONS = {
    "leaderTimeunitsAllocation": 100,
    "validatorTimeunitsAllocation": 200,
    "rotations": [1],
}


def explorer_tx(tx_id: Any) -> str:
    return f"{EXPLORER}/tx/{tx_id}"


def explorer_address(address: str) -> str:
    return f"{EXPLORER}/address/{address}"


def retry_rpc(fn, *, retries: int = 20, delay_s: float = 5.0):
    """Retry Studio Next reads when the execution pool is full."""
    last = None
    for attempt in range(retries):
        try:
            return fn()
        except Exception as exc:
            last = exc
            text = str(exc)
            if "Server busy" in text or "retry later" in text or "-32006" in text:
                print(
                    f"[evidence] rpc busy attempt={attempt + 1}/{retries}: {exc}"
                )
                time.sleep(delay_s)
                continue
            raise
    raise last


def native_balance(address: str) -> int:
    client = get_gl_client()
    return int(
        retry_rpc(lambda: client.get_balance(Web3.to_checksum_address(address)))
    )


def transaction_fee_preset():
    estimate = get_gl_client().estimate_transaction_fees(FEE_ESTIMATE_OPTIONS)
    return {
        "distribution": estimate["distribution"],
        "feeValue": estimate["feeValue"],
    }


def write_fee_preset(contract, method_name: str, args=None, value: int = 0, account=None):
    """Live SDK estimate for a concrete write, including message-emitting calls."""
    client = get_gl_client()
    estimate = client.estimate_transaction_fees_for_write(
        address=contract.address,
        function_name=method_name,
        account=account or contract.account,
        args=args or [],
        value=value,
        options=FEE_ESTIMATE_OPTIONS,
    )
    fees = {
        "distribution": estimate["distribution"],
        "feeValue": estimate["feeValue"],
    }
    if estimate.get("messageAllocations") is not None:
        fees["messageAllocations"] = estimate["messageAllocations"]
    return fees


def receipt_evidence(label: str, receipt: dict) -> dict:
    consensus = receipt.get("consensus_data") or {}
    leader = consensus.get("leader_receipt")
    if isinstance(leader, list) and leader:
        leader = leader[0]
    if not isinstance(leader, dict):
        leader = {}
    tx_id = receipt.get("hash") or receipt.get("tx_id") or receipt.get("id")
    data = receipt.get("data") or {}
    accounting = data.get("fee_accounting") or {}
    evidence = {
        "label": label,
        "tx_id": tx_id,
        "explorer": explorer_tx(tx_id) if tx_id else None,
        "status": receipt.get("status_name") or receipt.get("status"),
        "execution": receipt.get("tx_execution_result_name")
        or receipt.get("tx_execution_result"),
        "leader_execution": leader.get("execution_result"),
        "value_credited": receipt.get("value_credited"),
        "messages": receipt.get("messages") or leader.get("messages") or [],
        "pending_transactions": leader.get("pending_transactions") or [],
        "triggered_transactions": receipt.get("triggered_transactions") or [],
        "lifecycle": receipt.get("lifecycle"),
        "paid_fee_value": accounting.get("paid_fee_value"),
        "primary_fee_spent": accounting.get("primary_fee_spent"),
        "total_refunded": accounting.get("total_refunded"),
        "sender_fee_spent": sender_fee_spent(receipt),
    }
    print(f"[evidence] {label}: {evidence}")
    return evidence


def wait_child_receipts(parent_receipt: dict, wait_until: str = "finalized") -> list[dict]:
    client = get_gl_client()
    children = list(parent_receipt.get("triggered_transactions") or [])
    getter = getattr(client, "get_triggered_transaction_ids", None)
    tx_id = parent_receipt.get("hash") or parent_receipt.get("tx_id") or parent_receipt.get("id")
    if getter is not None and tx_id:
        try:
            extra = getter(tx_id)
            if extra:
                children.extend(list(extra))
        except Exception as exc:
            print(f"[evidence] get_triggered_transaction_ids failed: {exc}")
    seen = []
    unique = []
    for child in children:
        key = str(child)
        if key in seen:
            continue
        seen.append(key)
        unique.append(child)
    child_receipts = []
    for child in unique:
        receipt = client.wait_for_transaction_receipt(
            transaction_hash=child,
            wait_until=wait_until,
            retries=80,
            interval=4000,
            full_transaction=True,
        )
        child_receipts.append(receipt_evidence(f"child:{child}", receipt))
    return child_receipts


def sender_fee_spent(receipt: dict) -> int:
    """Net wei the sender spent on fees for this transaction."""
    data = receipt.get("data") or {}
    accounting = data.get("fee_accounting") or {}
    paid = int(accounting.get("paid_fee_value") or data.get("fee_value") or 0)
    refunded = int(accounting.get("total_refunded") or 0)
    if paid:
        return max(paid - refunded, 0)
    spent = int(accounting.get("primary_fee_spent") or 0)
    return max(spent, 0)


def poll_native_deltas(
    *,
    contract_address: str,
    recipient_address: str,
    contract_before: int,
    recipient_before: int,
    expected: int,
    recipient_fee: int,
    timeout_s: int = 180,
    interval_s: float = 4.0,
) -> dict:
    """Poll until the contract drops `expected` and the recipient's native balance rises.

    Receipt `fee_accounting` can under- or over-state the wei the recipient
    actually spent. Settlement is judged from native balances: the contract
    must lose exactly `expected`, and the recipient must gain a positive
    amount no larger than `expected` (the gap is the fee they paid).
    """
    deadline = time.time() + timeout_s
    last = {}
    while time.time() < deadline:
        contract_now = native_balance(contract_address)
        recipient_now = native_balance(recipient_address)
        contract_drop = contract_before - contract_now
        recipient_gain = recipient_now - recipient_before
        inferred_fee = expected - recipient_gain
        last = {
            "contract_native": contract_now,
            "recipient_native": recipient_now,
            "contract_drop": contract_drop,
            "recipient_gain": recipient_gain,
            "recipient_fee_receipt": recipient_fee,
            "inferred_recipient_fee": inferred_fee,
            "recipient_net_with_receipt_fee": recipient_gain + recipient_fee,
            "expected": expected,
        }
        print(f"[evidence] poll {last}")
        delivered = (
            contract_drop == expected
            and recipient_gain > 0
            and recipient_gain <= expected
        )
        if delivered:
            last["settled"] = True
            return last
        time.sleep(interval_s)
    last["settled"] = False
    return last


def record_case(name: str, payload: dict) -> Path:
    """Write one Studio Next case file. Does not touch the product contract record."""
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    path = EVIDENCE_DIR / f"{name}.json"
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(f"[evidence] wrote {path}")
    return path
