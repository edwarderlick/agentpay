# AgentPay contract interface

This document records the **actual** Studio Next surface from this pass.

Product frontend writes use the dedicated AgentPay deploy below. Probe and `gltest` fixture addresses stay blocked in `isContractReady()`.

Network (locked):

| Item | Value |
| --- | --- |
| RPC | `https://studio-next.genlayer.com/api` |
| Chain ID | `61997` |
| Explorer | `https://explorer-studio-dev.genlayer.com/` |
| Studionet `61999` | unused |

Runner: Studio Next rejected the v2-dev boilerplate pin `py-genlayer:9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0` as `invalid_contract runner malformed`. Contracts use the working SDK pin `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`.

Integer wei only. A parent `SUCCESS` with a pending message is not a payout. Payout requires the contract native balance to fall by the withdrawn amount and the recipient native balance to rise. Receipt `fee_accounting` can misstate the recipient fee; settlement is judged from native balances (`contract_drop == expected` and `0 < recipient_gain <= expected`). External EOA transfers leave `triggered_transactions` empty; that is expected.

## Failed path — `gl.chain.Account.emit_transfer`

`SettlementProbe` (`contracts/settlement_probe.py`) is kept as evidence. `gl.chain.Account.emit_transfer` records a parent message and can finalize with `leader_execution=SUCCESS`, but **does not credit the recipient wallet**. Contract-held GEN does not decrease. `value_credited` stays `false`. `triggered_transactions` stays empty.

### Accounting model (probe)

| Field | Meaning |
| --- | --- |
| `credits[addr]` | Withdrawable credit for that wallet |
| `unused[addr]` | Depositor reclaim bucket, separate from credit |
| `in_flight[addr]` | Amount the parent tried to emit |
| `total_*` | Matching totals |
| `contract_balance` | Native GEN held by the contract |

### Probe methods

Writes: `deposit_credit(recipient)`, `deposit_unused()`, `withdraw()`, `attempt_withdraw_to(destination)`, `reclaim()`.

Views: `get_credit`, `get_unused`, `get_in_flight`, `get_wallet`, `get_accounting`, `get_contract_balance`.

### Studio Next evidence

#### Runner rejection (v2-dev pin)

- Tx: https://explorer-studio-dev.genlayer.com/tx/0x5cbe7fd9fd1e99c18ffd99519a7b56e9593db06fabc61aa2ef6edc2da356d3f5
- Status: `FINALIZED`, consensus `MAJORITY_AGREE`
- Leader `execution_result`: `ERROR`
- Result: `invalid_contract runner malformed`
- From: `0x4b0F0A1b5a0AcB402B0095E33f6800729669890e`

#### Path 1 — `emit_transfer(..., on="finalized")`

Probe: [`0x86f154Fa44A130BB9d653A42c3362C658B058837`](https://explorer-studio-dev.genlayer.com/address/0x86f154Fa44A130BB9d653A42c3362C658B058837)

| Step | Tx | Leader | Native effect |
| --- | --- | --- | --- |
| deposit_credit 0.01 GEN | [0x09488dca…](https://explorer-studio-dev.genlayer.com/tx/0x09488dca88ba3b23fa590b717a17fc68f79e2fe5360a92f08bcf3dd940f041fc) | SUCCESS | contract +1e16 |
| deposit_unused 0.01 GEN | [0x41c6bda5…](https://explorer-studio-dev.genlayer.com/tx/0x41c6bda5900f7426c980357e11bb4ddf1c5d0767c42869b7a28e455621a86d1d) | SUCCESS | contract +1e16 |
| unauthorized withdraw | [0x23428c13…](https://explorer-studio-dev.genlayer.com/tx/0x23428c1322cb6f794c3590b6120ea5147ab41dc077f81138cc2e86da2a21faa5) | ERROR | credit unchanged |
| credited withdraw | [0x521e3652…](https://explorer-studio-dev.genlayer.com/tx/0x521e36525c59583835c5213cb479e8e71f3cbd04eb461b699e63575fd38422cd) | SUCCESS | **no delivery** |

Withdraw `0x521e3652…` details:

- Lifecycle: finalized / accepted
- Execution: `FINISHED_WITH_RETURN`
- `value_credited`: **false**
- Message: type 0, value `10000000000000000`, recipient `0xAaA66a5dE1ABd8dbFD2D8A21177F4389bB8b7733`, `onAcceptance: false`
- `triggered_transactions`: **[]**
- After: contract native still `20000000000000000`; recipient native **fell** by fee; credit `0`; in_flight `10000000000000000`

#### Path 2 — `emit_transfer(..., on="decided")`

Probe: [`0x93f166F3d6BA408dC9d427B32d716dff6b705461`](https://explorer-studio-dev.genlayer.com/address/0x93f166F3d6BA408dC9d427B32d716dff6b705461)

| Step | Tx | Leader | Native effect |
| --- | --- | --- | --- |
| deposit_credit | [0x555ea679…](https://explorer-studio-dev.genlayer.com/tx/0x555ea6793f8fdf60b0e2b531b2316bb415f29ed27b43ec501b45631a1d909cc7) | SUCCESS, `value_credited: true` | contract +1e16 |
| deposit_unused | [0x22498958…](https://explorer-studio-dev.genlayer.com/tx/0x224989583968fd8f8ba33e1bb84826b345a5ab2b73f3da2a7b9c1df550126d6d) | SUCCESS, `value_credited: true` | contract +1e16 |
| unauthorized withdraw | [0xa36ea9e0…](https://explorer-studio-dev.genlayer.com/tx/0xa36ea9e075a9253513aeafc2f6db31dc6c585d00632bf7be622689fb98d9b7d6) | ERROR | credit unchanged |
| credited withdraw | [0x315cbdf5…](https://explorer-studio-dev.genlayer.com/tx/0x315cbdf5e99cd8534aeb60381ca0299b019f3eba52ac1949fe8fa88995bcc080) | SUCCESS | **no delivery** |

Inbound payable deposits **do** increase contract balance (`value_credited: true`). Outbound `gl.chain.Account.emit_transfer` does **not** decrease it.

## Proven path — EOA `EmitExternalMessage`

Documented host call (installed SDK: `gl.u256` is not callable; pass a plain `int`):

```python
@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass

_Recipient(gl.Address(recipient)).emit_transfer(value=amount)
```

This is not `gl.chain.Account` and does not take `on=`. The host call is `EmitExternalMessage` with empty calldata (`is_eth_send: True`).

Probe: `EoaTransferProbe` (`contracts/eoa_transfer_probe.py`).

Address: [`0x0a18edf32FfB3B58ED274207210E7516FF77b058`](https://explorer-studio-dev.genlayer.com/address/0x0a18edf32FfB3B58ED274207210E7516FF77b058)

Recipient EOA: `0x742496A560d1FA15447dDB55538AD2b3282E6741`

| Step | Tx | Leader | Native effect |
| --- | --- | --- | --- |
| deposit 0.01 GEN | [0xeccb8c81…](https://explorer-studio-dev.genlayer.com/tx/0xeccb8c81ebea1ea3036744b48e2d48857284b609a7b1cac589039a3002550cfb) | SUCCESS, `value_credited: true` | contract `0` → `1e16` |
| unauthorized withdraw | [0x69f18b48…](https://explorer-studio-dev.genlayer.com/tx/0x69f18b481620845cc7ff69150c4855ec44a0365bb223607c4a52150f4f2bb552) | ERROR | credit unchanged |
| insufficient credit | [0x685b1a75…](https://explorer-studio-dev.genlayer.com/tx/0x685b1a7503c5013647290cb97b30d991ab6f9469db61fec8d5139f2be5a0bbff) | ERROR | credit unchanged |
| credited withdraw | [0xb76d9ac9…](https://explorer-studio-dev.genlayer.com/tx/0xb76d9ac94194da838087a03a73ddb09b9c2ddc6c8d70b36de8682c3ac2909237) | SUCCESS | **delivered** |

Withdraw `0xb76d9ac9…` details:

- Lifecycle: finalized / accepted
- Message: type 0, value `10000000000000000`, recipient `0x742496A560d1FA15447dDB55538AD2b3282E6741`, `onAcceptance: false`
- Pending: `is_eth_send: true`, `on: finalized`
- `triggered_transactions`: `[]` (external transfer, no child contract call)
- `value_credited`: false on the parent (the credit is the outbound native send, not inbound `msg.value`)
- After: contract native `0`; recipient native `1000009873694999999177`; recipient gain `9873694999999177`; inferred recipient fee `126305000000823`
- Receipt `sender_fee_spent` (`251305000000823`) overstated the recipient fee by `1.25e14`. Settlement uses native balances.

## AgentPay registry — implemented

Contract class: `AgentPay` (`contracts/agentpay.py`). Native payouts use the proven `_Recipient.emit_transfer(value=int)` path. Purpose judgment uses `gl.vm.run_nondet` with an outcome-only validator (`APPROVED` / `DENIED` / `UNCLEAR`); full JSON `strict_eq` failed on Studio because reason text differs across validators.

### Writes

| Method | Caller | Payable | Effect |
| --- | --- | --- | --- |
| `create_mandate(mandate_id, title, purpose, agent, merchants, per_payment_cap, expiry)` | owner | yes, `msg.value` is budget | freeze purpose, agent, merchant allowlist, cap, budget, expiry |
| `issue_invoice(invoice_id, mandate_id, purpose, amount)` | allowlisted merchant | no | store invoice; **no fund movement** |
| `request_payment(request_id, mandate_id, invoice_id)` | frozen agent | no | pre-model checks, then purpose judgment; credit merchant only on `APPROVED` |
| `withdraw_credit(mandate_id, amount)` | credited merchant | no | EOA emit of `amount`; credit reduced after emit; credit kept if emit reverts |
| `close_mandate(mandate_id)` | owner | no | refund uncommitted `remaining_budget` only |

Caller-supplied unique IDs. IDs are rejected if already used.

### Views

List methods take `(offset, limit)` (address or mandate id first when scoped) and return `{ids,total,offset,limit,has_more}`. `PAGE_MAX` is 50. JSON id indexes replace the old first-32 slice.

| Method | Result |
| --- | --- |
| `get_mandate(mandate_id)` | mandate fields plus `status` (`active` / `expired` / `closed`) |
| `get_invoice(invoice_id)` | invoice fields |
| `get_request(request_id)` | request fields including `outcome` and `reason` |
| `get_merchant_credit(mandate_id, merchant)` | remaining credit wei |
| `get_withdrawn(mandate_id, merchant)` | cumulative withdrawn wei |
| `get_merchant_credit_row(mandate_id, merchant)` | `{mandate_id,merchant,credit,withdrawn}` |
| `list_mandates_for_owner(owner, offset, limit)` | paginated ids |
| `list_mandates_for_agent(agent, offset, limit)` | paginated ids |
| `list_mandates_for_merchant(merchant, offset, limit)` | paginated ids |
| `list_invoices_for_mandate(mandate_id, offset, limit)` | paginated ids |
| `list_invoices_for_merchant(merchant, offset, limit)` | paginated ids |
| `list_requests_for_mandate(mandate_id, offset, limit)` | paginated ids |
| `list_requests_for_agent(agent, offset, limit)` | paginated ids |
| `list_credit_mandates_for_merchant(merchant, offset, limit)` | paginated mandate ids with credit |
| `list_mandates(offset, limit)` | public mandate ids |
| `list_requests(offset, limit)` | public request ids |
| `get_accounting()` | `{contract_balance, total_remaining, total_credits, backed, uncommitted}` |
| `get_contract_balance()` | native wei |
| `get_schema()` | name, outcomes, views, writes, page_max |

### Studio Next evidence (integration, 2026-10-07)

Contract: [`0x00c12559fa8C78e76F369a0d513ce45447E61892`](https://explorer-studio-dev.genlayer.com/address/0x00c12559fa8C78e76F369a0d513ce45447E61892)

Mandate `studio-m-1a115750de7`. Owner `0xab34969Bc739EfC31ff8f8e4B028B3aA4FC73C04`. Agent `0x5A8119220E63FAE2f4D0B9284E341E3253298167`. Merchant `0xBcB391494A3B0726952558f4Cc66b6562539755B`. Budget `2e16`, payment `1e16`.

| Step | Tx | Leader | Notes |
| --- | --- | --- | --- |
| create_mandate | [0xbd82a2ac…](https://explorer-studio-dev.genlayer.com/tx/0xbd82a2ac307ff910c812d9bfffe6c853b340adb158e550b7a55db90cb247683f) | SUCCESS | `value_credited: true`; contract +`2e16`; remaining_budget `2e16` |
| issue_invoice | [0xdeca8488…](https://explorer-studio-dev.genlayer.com/tx/0xdeca84887728c98a78ff1191501156b82828249ef17a97460a107404b42df802) | SUCCESS | contract balance unchanged |
| forged merchant | [0x35dcb978…](https://explorer-studio-dev.genlayer.com/tx/0x35dcb978ff892105936c13b9007f5277eb5e6176bdb25d628af9306ecac13a8f) | ERROR | credit unchanged |
| unauthorized agent | [0x0cc8caa2…](https://explorer-studio-dev.genlayer.com/tx/0x0cc8caa2f369320720e6881924be48ded4d750276b5ec2cab6f158ed94a84360) | ERROR | no request stored |
| request_payment | [0x71975214…](https://explorer-studio-dev.genlayer.com/tx/0x7197521403774ef5e943eda66dc12a407a33feb282a4eb24486dd4425cd22630) | SUCCESS | outcome `APPROVED`; merchant credit `1e16`; remaining `1e16` |
| unauthorized withdraw | [0xb394d78e…](https://explorer-studio-dev.genlayer.com/tx/0xb394d78e24cb6b328b75257f8dab214ec0f9d266d35a205ad57ffec5c04bbc0f) | ERROR | credit still `1e16` |
| insufficient credit | [0x3995eceb…](https://explorer-studio-dev.genlayer.com/tx/0x3995ecebf85f3a4d3295ea97ea0fffc3d0db3e15132484ca042c63dd31006293) | ERROR | credit still `1e16` |
| withdraw_credit | [0xa7806ad4…](https://explorer-studio-dev.genlayer.com/tx/0xa7806ad410981b3922bf20c3c0657bb430cea33ad251cc6efeb056aea98eaf44) | SUCCESS | **delivered** |
| close_mandate | [0x7e221ac9…](https://explorer-studio-dev.genlayer.com/tx/0x7e221ac9f0f9d71c20b38d0203b74c261f6ec85b5dff03d33e38d5d06c09017e) | SUCCESS | **refund delivered** |

`request_payment` reason: `Invoice purpose is GPU cloud compute hours for inference, which is explicitly permitted by the mandate and does not match any prohibited category.`

Withdraw `0xa7806ad4…`:

- Message to merchant `0xBcB39149…`, value `1e16`, `is_eth_send: true`, `on: finalized`
- `triggered_transactions`: `[]`
- Sender fee (receipt): `251305000000823`
- After poll: contract `2e16` → `1e16` (`contract_drop == 1e16`); merchant gain `9873694999999177`; inferred fee `126305000000823`; credit `0`; settled

Close `0x7e221ac9…`:

- Message to owner `0xab34969B…`, value `1e16`, `is_eth_send: true`
- After poll: contract `1e16` → `0`; owner gain `9873691749999177`; inferred fee `126308250000823`; remaining_budget `0`; `closed: true`; settled

An earlier integration deploy [`0xdeE932fA7997325381d47808A3283eD4A420Ba22`](https://explorer-studio-dev.genlayer.com/address/0xdeE932fA7997325381d47808A3283eD4A420Ba22) proved create / invoice / request / withdraw, then hit Studio `Server busy` (`-32006`) on `get_merchant_credit` before `close_mandate`. Views now retry that error.

### Measured fee profile

Regenerated 2026-10-07T09:03:26Z on `studio_devnet` (chain `61997`) after paginated index writes, written to `frontend/fee-profile.json`. Values are max-observed × 1.25 headroom as decimal strings. Transaction Kit loads this file as fee suggestions.

| Method | executionBudgetPerRound | totalMessageFees |
| --- | --- | --- |
| deploy | `98513437500000` | `0` |
| create_mandate | `98295312500000` | `0` |
| issue_invoice | `98290000000000` | `0` |
| request_payment | `99167500000000` | `0` |
| withdraw_credit | `157882812500000` | `156250000000000` |
| close_mandate | `157885312500000` | `156250000000000` |

Message-emitting methods (`withdraw_credit`, `close_mandate`) carry a `totalMessageFees` budget. That fee is why recipient native gain is less than the withdrawn amount.

## Dedicated product deploy (Studio Next, 2026-10-07)

Recorded in `docs/PRODUCT_DEPLOY.json`. This is the only address the frontend may use.

Browser-signed product flow (create / invoice / `APPROVED` / native withdraw / close / refund) was re-read on 2026-10-09. Full hashes, calldata method names, and live views: [REVIEWER_EVIDENCE.md](REVIEWER_EVIDENCE.md). Negative cases stay on **fresh fixtures** in [EVIDENCE_MATRIX.md](EVIDENCE_MATRIX.md).

| Item | Value |
| --- | --- |
| Address | [`0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F`](https://explorer-studio-dev.genlayer.com/address/0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F) |
| Deploy tx | [`0xba9ba2fede114329de64f71698c5f71066b52376cf4b1df81cf5084c01de8fc3`](https://explorer-studio-dev.genlayer.com/tx/0xba9ba2fede114329de64f71698c5f71066b52376cf4b1df81cf5084c01de8fc3) |
| Deployer | `0xb594bca7F432Fd660CAe236b8b9908a0B731260A` |
| Runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| Chain | `61997` |
| Schema | `AgentPay`; outcomes `APPROVED` / `DENIED` / `UNCLEAR`; 5 writes; 19 views including paginated lists and `get_withdrawn` |

Blocked (not product): EOA probe `0x0a18edf3…`, failed Account probes `0x86f154Fa…` / `0x93f166F3…`, payment fixtures `0x00c12559…` / `0xdeE932fA…`, football `0x7F53A0e5…`, discovery fixture `0x7561080F…`. Evidence-matrix fixtures in `docs/EVIDENCE_MATRIX.md` are also not product.

Denied / UNCLEAR / prompt-injection / duplicate / over-cap / over-budget / expiry / unauthorized close / partial withdraw / close-uncommitted / page-two (>20 invoices) were proven on **fresh Studio Next fixtures**, not this product address. Direct-mode (mocked LLM) and Studio Next fixture results are recorded separately in `docs/EVIDENCE_MATRIX.md`. Those fixture hashes are not product-contract transactions.

## Frontend

- Chain ID `61997`, RPC `https://studio-next.genlayer.com/api`
- `genlayer-js` `2.0.0-rc.1`, Transaction Kit RC2
- `NEXT_PUBLIC_CONTRACT_ADDRESS=0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F`
- `isContractReady()` is true for that address and false for blocked fixtures
- UI maps `APPROVED` → approved, `DENIED` → denied, `UNCLEAR` → unresolved
- Five writes go through Transaction Kit (fee quote, wallet approval, submit, tracking). Mandate budget is payable `userValue` in integer wei. IDs are generated in the app.
- Withdrawal/refund UI states: approved credit, tx submitted, tx finalized, native delivery confirmed, unresolved. Paid requires `contract_drop == expected` and `0 < recipient_gain <= expected`.

### Frontend test evidence

Ran from `frontend/`:

- `npm test` — mapping, pagination past 32 ids, unique write ids, payable wei, wrong network, wallet disconnect, delivery unpaid on parent receipt, payout localStorage resume, mobile menu
- `npm run lint` (`tsc --noEmit`)
- `npm run build`

Browser-signed owner / agent / merchant writes on the product contract are the hashes in [REVIEWER_EVIDENCE.md](REVIEWER_EVIDENCE.md). Vitest covers UI states without a browser wallet. Screenshots under `docs/wallet-frontend-verify/` are localhost (test GEN, 2026-10-07). `*-m-demo.png` / `docs/review-c-screens/` are design-demo or review fixtures.
