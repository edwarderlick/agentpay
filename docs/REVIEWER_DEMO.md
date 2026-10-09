# Three-wallet reviewer script

Studio Next **test GEN** only (chain `61997`). Use three wallets you control. The product owner / agent / merchant addresses in [REVIEWER_EVIDENCE.md](REVIEWER_EVIDENCE.md) are already used on-chain; do not send your test GEN to them unless you own those keys.

## Setup

1. Clone [github.com/edwarderlick/agentpay](https://github.com/edwarderlick/agentpay) and `npm ci` at the repo root.
2. Copy `frontend/.env.example` to `frontend/.env`. Keep `NEXT_PUBLIC_CONTRACT_ADDRESS=0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F`.
3. Fund each wallet with Studio Next test GEN from the Studio UI (`https://studio-next.genlayer.com`) so the owner can deposit a budget **and** all three can pay write fees.
4. `npm run dev` from the repo root (or `cd frontend && npm run dev`). Open `http://localhost:3000`.
5. Confirm the header chain is Studio Next `61997`. Writes stay blocked on any other chain.

Suggested small amounts: owner budget `0.02` GEN, cap `0.01` GEN, invoice `0.01` GEN, first withdraw `0.005` GEN.

## Script

1. **Owner — fund mandate.** Connect the owner wallet. `/mandates/new`. Purpose must be specific (for example GPU compute hours for a named test) and list what is forbidden. Set the agent address and one merchant address. Submit `create_mandate` with payable budget. Wait for leader `SUCCESS`. Open `/mandates/<id>` and confirm remaining budget equals the deposit.
2. **Merchant — invoice.** Disconnect, connect the merchant. `/invoices/new` for that mandate. Invoice purpose should match the frozen purpose. Submit `issue_invoice`. Confirm the invoice exists and contract native balance is unchanged.
3. **Agent wallet — purpose decision.** Connect the agent. `/requests/new`. Submit `request_payment`. Wait for consensus. On `/decisions/<requestId>` the outcome should be `APPROVED` if the invoice fits. Confirm merchant credit equals the invoice amount and remaining budget fell by that amount. Native GEN still sits in the contract.
4. **Merchant — withdraw.** Connect the merchant. `/credits`. Withdraw part of the credit (`withdraw_credit`). Confirm the parent has `is_eth_send: true` and a value-bearing follow-up from the contract to the merchant. Credit falls; `get_withdrawn` rises. Do not treat parent `SUCCESS` alone as paid.
5. **Owner — refund.** Connect the owner. Close the mandate. Uncommitted remaining budget returns to the owner on the same native path. Leftover merchant credit is not swept; the merchant may withdraw it after close.

To see `DENIED`, invoice something the purpose forbids (domain renewal, personal subscription). Credit stays `0`; the invoice is still `used`.

## Fees

`frontend/fee-profile.json` (measured 2026-10-07T09:03:26Z) must be loaded by Transaction Kit. `withdraw_credit` and `close_mandate` include `totalMessageFees` `156250000000000`. Without that allocation, Studio Next rolls back with `Mode1MessageFeesRequireGenVMPerEmissionSupport` (see failed product hashes in [REVIEWER_EVIDENCE.md](REVIEWER_EVIDENCE.md)).

## WalletConnect

Optional. Injected EIP-6963 wallets work without it. A Reown project ID belongs only in local / Vercel env, never in git.
