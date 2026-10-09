# AgentPay reviewer evidence (product contract)

Independently re-read on **2026-10-09** against Studio Next RPC `https://studio-next.genlayer.com/api` (chain `61997`) using `genlayer-js` `getTransaction` and `readContract`. Method names come from `data.calldata.readable`. The Studio Next explorer often labels every call `(constructor)`; ignore that column.

This file is **product-contract activity** on [`0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F`](https://explorer-studio-dev.genlayer.com/address/0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F) only.

| Layer | What it is | Where |
| --- | --- | --- |
| **Product contract** | Browser-signed writes on `0x754E97a7…1c2F` | This file |
| **Studio Next fixtures** | Fresh `gltest` deploys, including DENIED / reverts | [EVIDENCE_MATRIX.md](EVIDENCE_MATRIX.md) + `docs/evidence-matrix/*.json` |
| **Direct mode** | In-memory pytest, mocked LLM | [EVIDENCE_MATRIX.md](EVIDENCE_MATRIX.md#direct-mode) |

Fixture hashes must not be cited as transactions on the product address.

Deploy record: [PRODUCT_DEPLOY.json](PRODUCT_DEPLOY.json). Methods and the failed SettlementProbe: [CONTRACT_INTERFACE.md](CONTRACT_INTERFACE.md).

---

## Product identities

| Item | Value |
| --- | --- |
| Contract | [`0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F`](https://explorer-studio-dev.genlayer.com/address/0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F) |
| Deploy tx | [`0xba9ba2fede114329de64f71698c5f71066b52376cf4b1df81cf5084c01de8fc3`](https://explorer-studio-dev.genlayer.com/tx/0xba9ba2fede114329de64f71698c5f71066b52376cf4b1df81cf5084c01de8fc3) |
| Deployer | `0xb594bca7F432Fd660CAe236b8b9908a0B731260A` |
| Owner | `0x31e14df3b4f47F2428F3B78E7279691A78f70a05` |
| Agent wallet | `0x7E4E1f7DcC3DA063F9110477Ad348C90E8599253` |
| Merchant | `0x9471C57aF9DF875d4D42EDb046e446E85D9CFE3A` |

`list_mandates(0, 20)` independently re-read on 2026-10-09 later in the day returned four ids: `m-a56f4429378650ae158a`, `m-c690fd8825e402e54f11`, `prod-live-m-1a121152fbe`, and `m-e59146e56f2f36d3b770`. The MetaMask create documented below is only `m-e59146e56f2f36d3b770`.

GEN amounts below are **Studio Next test GEN**.

---

## Mandate `m-a56f4429378650ae158a` (closed spent case)

Live `get_mandate` (2026-10-09): `status=closed`, `remaining_budget=0`, `total_budget=20000000000000000` (0.02 GEN), `per_payment_cap=10000000000000000` (0.01 GEN), title `AgentPay browser test 1`. Purpose: GPU compute hours for AgentPay inference tests; domain / personal / ads / travel / hardware prohibited.

| ID | Live view |
| --- | --- |
| Invoice `inv-65221573143df782cccc` | amount 0.01 GEN, `used=true`, purpose “GPU compute hours used to run AgentPay inference tests.” |
| Request `req-164bd8f45936ae77b467` | `outcome=APPROVED`, reason: invoice matches allowed GPU compute hours |
| Merchant credit row | `credit=0`, `withdrawn=10000000000000000` (0.01 GEN) |

### Claimed steps

Explorer base: `https://explorer-studio-dev.genlayer.com/tx/<hash>`.

| Step | Method (RPC `calldata.readable`) | From | Value | Tx | Leader | Expected | Observed 2026-10-09 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Deploy | constructor (`readable` `{}`, contract code present) | `0xb594bc…260A` | 0 | [0xba9ba2fe…8fc3](https://explorer-studio-dev.genlayer.com/tx/0xba9ba2fede114329de64f71698c5f71066b52376cf4b1df81cf5084c01de8fc3) | SUCCESS, `FINISHED_WITH_RETURN`, `MAJORITY_AGREE` | AgentPay schema | `get_schema` name `AgentPay`; 5 writes, 19 views |
| Create + deposit | `create_mandate` (`m-a56f4429378650ae158a`, cap `1e16`, expiry `1792040280`) | owner `0x31e14d…0a05` | `2e16` (`value_credited: true`) | [0xce0221d8…6491](https://explorer-studio-dev.genlayer.com/tx/0xce0221d8dea2fb3dc493bca2b3c9bc09e8be9ca7923180223d825d7aef3c6491) | SUCCESS | Mandate stored, budget 0.02 GEN | Mandate exists; later remaining 0 after close |
| Invoice | `issue_invoice` (`inv-65221573143df782cccc`, amount `1e16`) | merchant `0x9471C5…FE3A` | 0 | [0x04f20849…a8a5](https://explorer-studio-dev.genlayer.com/tx/0x04f20849717809aafa766fa9d99195bc3c90fd3898d20927ca070bb1782ba8a5) | SUCCESS | Invoice stored, no native move | Invoice present, `used=true` after decision |
| Purpose decision | `request_payment` (`req-164bd8f45936ae77b467`) | agent `0x7E4E1f…9253` | 0 | [0x47f924b9…7e79](https://explorer-studio-dev.genlayer.com/tx/0x47f924b95f93e0c72b70ca5dc2c33072f143b2ad76cbc9cf7b5454c8a2047e79) | SUCCESS | `APPROVED` credit 0.01 GEN, remaining 0.01 GEN, invoice used | Live request `APPROVED`; invoice `used=true`; withdrawn later 0.01 GEN |
| Merchant withdraw | `withdraw_credit` (`5e15`) | merchant | 0 | [0x063ea623…1736](https://explorer-studio-dev.genlayer.com/tx/0x063ea623194c0849c1ab8a89217458c84da37f5a05a2ef5636a032b1fb931736) | SUCCESS | Native 0.005 GEN to merchant | Message + `is_eth_send: true` to merchant for `5e15` |
| Native send (child) | value transfer contract → merchant | contract | `5e15` | [0x2bb58c62…5163](https://explorer-studio-dev.genlayer.com/tx/0x2bb58c62b1d0a90223c2661065227b4ccc01a213c0645a35434aff02b44e5163) | `NOT_VOTED` / `NO_MAJORITY` (typical for this native send) | Same amount credited to merchant | `from` contract, `to` merchant, `value=5e15`, `value_credited: true` |
| Owner close | `close_mandate` | owner | 0 | [0x57695d07…c550](https://explorer-studio-dev.genlayer.com/tx/0x57695d077086023b0493d98d13ef99b48f9a3ec01de5c9fb779b4d22ad99c550) | SUCCESS | Refund remaining 0.01 GEN | Message + `is_eth_send: true` to owner for `1e16` |
| Native refund (child) | value transfer contract → owner | contract | `1e16` | [0x18d475b4…cecb](https://explorer-studio-dev.genlayer.com/tx/0x18d475b4f6826ab416b450ad7c6d9f1b84f5b7a960d4371de328aeb201cbcecb) | `NOT_VOTED` / `NO_MAJORITY` | Same amount to owner | `from` contract, `to` owner, `value=1e16`, `value_credited: true` |
| Second withdraw | `withdraw_credit` (`5e15`) | merchant | 0 | [0xacc2665c…3fbb](https://explorer-studio-dev.genlayer.com/tx/0xacc2665cd10a94533dc8e2cd14b37674218b5dc4dc783efb705c082ccab93fbb) | SUCCESS | Remaining 0.005 GEN credit | `is_eth_send: true` to merchant for `5e15` |
| Native send (child) | value transfer contract → merchant | contract | `5e15` | [0x3e883430…e7fb](https://explorer-studio-dev.genlayer.com/tx/0x3e883430cbd435eb677a640b882580ad9017139b542ce305cc76f5b4e0d3e7fb) | `NOT_VOTED` / `NO_MAJORITY` | Same amount | `from` contract, `to` merchant, `value=5e15` |

Close happened **between** the two 0.005 GEN withdrawals. That is allowed: close refunds uncommitted remaining budget only; leftover merchant credit stays withdrawable. After both withdrawals, live credit is `0` and withdrawn is `0.01` GEN.

Public frontend routes (after Vercel, or on `localhost:3000`):

- `/mandates/m-a56f4429378650ae158a`
- `/invoices/inv-65221573143df782cccc`
- `/decisions/req-164bd8f45936ae77b467`

---

## Mandate `m-c690fd8825e402e54f11` (create / deposit only)

Included because create tx + live state match.

| Step | Method | From | Value | Tx | Leader | Expected | Observed 2026-10-09 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create + deposit | `create_mandate` (`m-c690fd8825e402e54f11`, cap `1e17`, expiry `1792135740`) | owner | `1e18` (`value_credited: true`) | [0x812b29d0…88d5](https://explorer-studio-dev.genlayer.com/tx/0x812b29d0f72c40bf317cb7005ef52482a93f03fb121321f3771988c933c688d5) | SUCCESS | Active mandate, remaining 1 GEN | `status=active`, `remaining_budget=1e18`, `total_budget=1e18`, no invoices, withdrawn 0 |

Title: `AgentPay recovery browser test`. This mandate was **not** invoiced, judged, withdrawn, or closed on the product contract.

Live `get_accounting` earlier on 2026-10-09: `contract_balance=1e18`, `total_remaining=1e18`, `total_credits=0`, `uncommitted=1e18`. That 1 GEN was the `m-c690` budget. `m-a56f` no longer holds native GEN. After the Vercel MetaMask create below, explorer contract native is **1.01 GEN** (`m-c690` 1 GEN plus `m-e591` 0.01 GEN).

---

## Mandate `m-e59146e56f2f36d3b770` (Vercel MetaMask create)

Independently re-read on **2026-10-09** with `genlayer-js` `getTransaction` and `readContract` against Studio Next RPC. This is a **browser-signed create** from the live Vercel app using **injected MetaMask** on Studio Next. WalletConnect QR signing was **not** completed and remains **unverified**.

Live `get_mandate`:

| Field | Value |
| --- | --- |
| Id | `m-e59146e56f2f36d3b770` |
| Title | `Vercel wallet signing test` |
| Purpose | Permit GPU cloud compute for AgentPay inference testing. Prohibit personal purchases and subscriptions. |
| Status | `active` |
| Owner | `0x7E4E1f7DcC3DA063F9110477Ad348C90E8599253` |
| Agent | `0x31e14df3b4f47F2428F3B78E7279691A78f70a05` |
| Merchant | `0x9471C57aF9DF875d4D42EDb046e446E85D9CFE3A` |
| Total / remaining budget | `10000000000000000` (0.01 test GEN) |
| Per-payment cap | `5000000000000000` (0.005 test GEN) |
| Expiry | `1791644400` |

Owner and agent are swapped relative to the product-identity table above. This mandate used the previous agent wallet as owner.

| Step | Method (RPC `calldata.readable`) | From | Value | Tx | Leader | Expected | Observed 2026-10-09 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Deploy record | constructor (`readable` `{}`, contract code present) | `0xb594bc…260A` | 0 | [0xba9ba2fe…8fc3](https://explorer-studio-dev.genlayer.com/tx/0xba9ba2fede114329de64f71698c5f71066b52376cf4b1df81cf5084c01de8fc3) | SUCCESS, `FINISHED_WITH_RETURN`, `MAJORITY_AGREE` | AgentPay schema on product address | Same deploy as the rest of this file |
| Create + deposit | `create_mandate` (`m-e59146e56f2f36d3b770`, cap `5e15`, expiry `1791644400`) | owner `0x7E4E1f…9253` | `1e16` (`value_credited: true`) | [0xd719d608…60be](https://explorer-studio-dev.genlayer.com/tx/0xd719d60892e88ced3bcfe04adf7fdd8b842336d4bef0dbdd1eb2e342fe3c60be) | `FINALIZED`, `FINISHED_WITH_RETURN`, `MAJORITY_AGREE`, lifecycle `accepted` | Active mandate, remaining 0.01 GEN | Live mandate matches; `user_value` `1e16`; no invoice / request / withdraw / close on this id |

Public page: [`/mandates/m-e59146e56f2f36d3b770`](https://agentpay-omega-one.vercel.app/mandates/m-e59146e56f2f36d3b770).

This mandate was **not** invoiced, judged, withdrawn, or closed. No further product write is claimed here.

---

## Failed product writes (engineering, not happy-path product behavior)

These four calls targeted the product contract, finalized with leader `ERROR` / `FINISHED_WITH_ERROR`, and rolled back. Payload: `Mode1MessageFeesRequireGenVMPerEmissionSupport: fee-bearing GenVM messages require a message allocation tree`. Contract credit / remaining budget did not pay out. Later calls succeeded after `frontend/fee-profile.json` supplied `totalMessageFees` for `withdraw_credit` and `close_mandate`.

| Intended method | Tx | From | Args |
| --- | --- | --- | --- |
| `withdraw_credit` 0.005 GEN | [0x35e08156…090d](https://explorer-studio-dev.genlayer.com/tx/0x35e08156bff9e329c9d831aa19f72e92024d6a8975fe213bae5af9befe34090d) | merchant | `m-a56f…`, `5e15` |
| `close_mandate` | [0x9e9b3fe1…6d72](https://explorer-studio-dev.genlayer.com/tx/0x9e9b3fe139ce3a8e5adbdbac554ae523e79ecb033649fce14fa917782d716d72) | owner | `m-a56f…` |
| `withdraw_credit` 0.005 GEN | [0x53402a6a…7d73](https://explorer-studio-dev.genlayer.com/tx/0x53402a6ab736604c433eb726f35456d4c02a9d970021fc6aa6625f3b10cd7d73) | merchant | `m-a56f…`, `5e15` |
| `withdraw_credit` 0.01 GEN | [0xc2455796…28a5](https://explorer-studio-dev.genlayer.com/tx/0xc2455796fb65aaf65a8362f3f027c5f68fc8baedd027ad18cbdd1711e61128a5) | merchant | `m-a56f…`, `1e16` |

These are **failed fee-allocation probes on the product address**, not DENIED judgments and not unauthorized-role reverts.

---

## Settlement

`APPROVED` on `req-164bd8f45936ae77b467` created merchant credit. Native GEN did not leave the contract on that transaction (`messages=[]`, no `is_eth_send`).

Payment is the later `withdraw_credit` / `close_mandate` path:

1. Parent leader `SUCCESS` and `FINISHED_WITH_RETURN`.
2. Leader `messages[]` and `pending_transactions[]` with `is_eth_send: true`, recipient and value matching the call.
3. A follow-up transaction `from` the product contract `to` that recipient with the same `value`.

On 2026-10-09 this pass **did not re-query historical wallet native balances at the payout timestamp**. Delivery on the product address is proven from the parent `is_eth_send` records plus the matching value-bearing child transactions, plus live accounting (`m-a56f` remaining 0, withdrawn 0.01 GEN, contract native = 1 GEN = `m-c690` remaining).

Measured `contract_drop` and `recipient_gain` (recipient native up, less message fee) were recorded on **fixture** contracts:

- Happy-path fixture [`0x00c12559fa8C78e76F369a0d513ce45447E61892`](https://explorer-studio-dev.genlayer.com/address/0x00c12559fa8C78e76F369a0d513ce45447E61892) in [CONTRACT_INTERFACE.md](CONTRACT_INTERFACE.md) (withdraw [0xa7806ad4…](https://explorer-studio-dev.genlayer.com/tx/0xa7806ad410981b3922bf20c3c0657bb430cea33ad251cc6efeb056aea98eaf44), close [0x7e221ac9…](https://explorer-studio-dev.genlayer.com/tx/0x7e221ac9f0f9d71c20b38d0203b74c261f6ec85b5dff03d33e38d5d06c09017e)).
- Partial withdraw fixture in [EVIDENCE_MATRIX.md](EVIDENCE_MATRIX.md) / `docs/evidence-matrix/studio-partial-withdraw-close-uncommitted.json`.

Those fixture hashes are **not** product-contract transactions.

### Failed SettlementProbe (not product behavior)

`gl.chain.Account.emit_transfer` finalizes a parent message and does **not** credit the recipient. Contract-held GEN does not fall. Kept as `contracts/settlement_probe.py` and documented in [CONTRACT_INTERFACE.md](CONTRACT_INTERFACE.md#failed-path--glchainaccountemit_transfer).

Proven path: `_Recipient(addr).emit_transfer(value=int)` (`contracts/eoa_transfer_probe.py`, probe [`0x0a18edf3…b058`](https://explorer-studio-dev.genlayer.com/address/0x0a18edf32FfB3B58ED274207210E7516FF77b058), withdraw [0xb76d9ac9…](https://explorer-studio-dev.genlayer.com/tx/0xb76d9ac94194da838087a03a73ddb09b9c2ddc6c8d70b36de8682c3ac2909237)). AgentPay uses that path.

---

## What this file does not claim

- WalletConnect QR / mobile signing (unverified).
- Invoice, purpose decision, withdraw, or close on `m-e59146e56f2f36d3b770`.
- Native recipient-gain wei at payout time on the product address (not re-measured in this pass).
- Negative-case judgments on the product address (see the matrix).
- An autonomous agent service.
- Audit, mainnet, or real-money settlement.
