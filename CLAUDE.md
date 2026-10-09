# CLAUDE.md

AgentPay on GenLayer Studio Next. Product contract, chain, RPC, runner, and SDK versions are locked. Do not redeploy for frontend-only work. Do not push to the GenLayer boilerplate remote.

| Item | Value |
| --- | --- |
| RPC | `https://studio-next.genlayer.com/api` |
| Chain | `61997` |
| Product | `0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F` |
| Runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| GenVM pin | `v0.6.0-rc8` (`GENVM_ALLOW_PRERELEASE=1`) |

Reviewer docs: `README.md`, `docs/REVIEWER_EVIDENCE.md`, `docs/EVIDENCE_MATRIX.md`, `docs/CONTRACT_INTERFACE.md`, `docs/VERCEL.md`.

## Commands

```bash
genvm-lint check contracts/agentpay.py --json
python -m pytest tests/direct/ -v
gltest tests/integration/test_agentpay.py -k test_studio_next_denied_invoice -v -s --network studio_devnet

npm ci
npm test --workspace frontend
npm run lint --workspace frontend
npm run build
```

On Windows run one `gltest -k test_studio_next_<name>` per invocation. Do not use localnet for Studio Next evidence.

Writes: `create_mandate`, `issue_invoice`, `request_payment`, `withdraw_credit`, `close_mandate`. Native payouts use `_Recipient.emit_transfer(value=int)`, not `gl.chain.Account.emit_transfer`.

Frontend: `frontend/lib/contract/adapter.ts`, `frontend/lib/genlayer/WalletProvider.tsx`. Vercel Root Directory is `frontend`.

An agent is an authorized wallet. Do not claim an autonomous agent service.

SDK API: https://sdk.genlayer.com/main/_static/ai/api.txt
