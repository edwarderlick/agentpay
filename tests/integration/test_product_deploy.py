"""Dedicated Studio Next product deploy. Not a probe or payment-path fixture.

Run with:
  gltest tests/integration/test_product_deploy.py -v -s --network studio_devnet
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest
from gltest import get_contract_factory, get_default_account, get_gl_client

from studio_evidence import (
    explorer_address,
    native_balance,
    retry_rpc,
    transaction_fee_preset,
)


pytestmark = pytest.mark.integration

EVIDENCE_PATH = Path(__file__).resolve().parents[2] / "docs" / "PRODUCT_DEPLOY.json"
FUND_AMOUNT = 10**21
RUNNER = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng"


def test_dedicated_product_deploy():
    client = get_gl_client()
    chain = client.chain
    assert chain.id == 61997
    rpc = chain.rpc_urls["default"]["http"][0]
    assert "studio-next.genlayer.com" in rpc

    owner = get_default_account()
    before = native_balance(owner.address)
    if before < FUND_AMOUNT // 2:
        fund_tx = client.fund_account(owner.address, FUND_AMOUNT)
        print("[product] fund", fund_tx)

    factory = get_contract_factory("AgentPay")
    contract = factory.deploy(fees=transaction_fee_preset(), wait_until="finalized")
    print("[product] address", contract.address, explorer_address(contract.address))

    schema = retry_rpc(lambda: contract.get_schema(args=[]).call())
    print("[product] schema", schema)
    assert schema["name"] == "AgentPay"
    assert schema["page_max"] == 50
    for method in (
        "create_mandate",
        "issue_invoice",
        "request_payment",
        "withdraw_credit",
        "close_mandate",
    ):
        assert method in schema["writes"]
    for view in (
        "list_mandates_for_owner",
        "list_mandates_for_agent",
        "list_mandates_for_merchant",
        "list_requests",
        "get_withdrawn",
    ):
        assert view in schema["views"]

    accounting = retry_rpc(lambda: contract.get_accounting(args=[]).call())
    assert int(accounting["contract_balance"]) == 0
    empty = retry_rpc(lambda: contract.list_mandates(args=[0, 20]).call())
    assert int(empty["total"]) == 0

    deploy_tx = getattr(contract, "id", None) or getattr(contract, "hash", None)
    evidence = {
        "address": contract.address,
        "explorer": explorer_address(contract.address),
        "deployTx": deploy_tx,
        "chainId": 61997,
        "rpc": "https://studio-next.genlayer.com/api",
        "runner": RUNNER,
        "schema": schema,
        "deployer": owner.address,
        "kind": "product",
        "note": "Dedicated product deploy. Not a probe or gltest payment fixture.",
    }
    EVIDENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print("[product] wrote", EVIDENCE_PATH)
    print("[product] ready", json.dumps(evidence, indent=2))
