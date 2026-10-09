# AgentPay frontend

Next.js app for AgentPay, started from `genlayer-project-boilerplate` `v2-dev`.

## Network

Studio Next only:

- RPC `https://studio-next.genlayer.com/api`
- Chain ID `61997`
- Explorer `https://explorer-studio-dev.genlayer.com/`

Do not point this app at Studionet (`61999`).

## Scripts

From the repository root (`D:\AgentPay\app`):

```bash
npm run dev
npm run lint
npm run build
```

Frontend tests:

```bash
cd frontend
npm test
```

## Wallet

The app discovers injected EIP-6963 wallets (MetaMask, Rabby, Coinbase Wallet, Brave, and others that announce). `window.ethereum` is only a fallback when nothing announces. The selected provider is the one passed to Transaction Kit.

WalletConnect (QR / mobile) needs `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` from [Reown Cloud](https://cloud.reown.com/). Allow `http://localhost:3000` and the production origin. If the ID is missing, injected wallets still work and the chooser says WalletConnect is not configured.

Disconnecting clears the AgentPay session. It does not revoke the extension’s permission.

See `docs/VERCEL.md` for the deployment env list. Vercel Root Directory is `frontend` (Git root is this `app` repository).

## Honesty rules

Default views read the dedicated Studio Next AgentPay contract `0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F`. Design-sample data stays behind the **design demo** toggle and a persistent banner. Probe and `gltest` fixture addresses are blocked. See `docs/CONTRACT_INTERFACE.md`.
