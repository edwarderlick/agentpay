# Vercel deployment checklist

Do not deploy until this checklist is reviewed.

## Required environment variables

Set these on the Vercel project (Production and Preview):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F` |
| `NEXT_PUBLIC_GENLAYER_CHAIN_ID` | `61997` |
| `NEXT_PUBLIC_GENLAYER_CHAIN_NAME` | `GenLayer Studio Next` |
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | `https://studio-next.genlayer.com/api` |
| `NEXT_PUBLIC_GENLAYER_SYMBOL` | `GEN` |
| `NEXT_PUBLIC_EXPLORER_URL` | `https://explorer-studio-dev.genlayer.com` |

## WalletConnect (optional but required for QR / mobile)

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown Cloud project ID |

1. Create a project at [https://cloud.reown.com/](https://cloud.reown.com/).
2. Copy the **project ID** (public).
3. Allowed domains / origins:
   - `http://localhost:3000`
   - `https://agentpay-omega-one.vercel.app`
   - `https://agentpay-edwarderlicks-projects.vercel.app`
   - any custom domain
4. Redeploy after adding the variable. Client env vars are inlined at build time.

Without this ID, injected EIP-6963 wallets still work. The chooser shows WalletConnect as not configured.

## Repository and Root Directory

The Git repository root is `D:\AgentPay\app` (`git rev-parse --show-toplevel`). That repo contains `frontend/` as a workspace.

Set the Vercel **Root Directory** to:

```
frontend
```

Do not use `app/frontend` unless the imported Git root is `D:\AgentPay` (it is not).

## Build

From the repository root (`D:\AgentPay\app`):

```bash
npm run lint
npm run build
```

Or from `frontend`:

```bash
npm test
npm run lint
npm run build
```

`frontend` `npm run build` is `next build --webpack`. Next 16 defaults to Turbopack, which cannot bundle WalletConnect's `pino`/`thread-stream` graph. Keep the webpack flag in Vercel’s Install/Build if you override the npm script.

## Post-deploy smoke

1. Open `/` — header shows **Connect wallet**, not `Wallet…`.
2. Open `/how-it-works`, `/dashboard`, `/explore`, `/credits`, `/mandates/new`.
3. Design demo stays off by default; enabling it shows **DESIGN DEMO — NOT CHAIN DATA**.
4. Connect an injected wallet. Confirm the same wallet name/address is used in write panels.
5. If the wallet is on another chain, public reads still work; writes stay blocked until chain `61997`.
6. WalletConnect QR / mobile signing is **unverified** in this submission. Injected MetaMask create on production is documented in [REVIEWER_EVIDENCE.md](REVIEWER_EVIDENCE.md).
7. Do not treat a successful page load as a signed payout.
