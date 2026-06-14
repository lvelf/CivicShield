# CivicShield × Ledger — human-in-the-loop relief approval

The AI agent only **proposes** releases. A release at or above the pool's review threshold is held
on-chain as `PENDING_REVIEW` and **cannot move until a Ledger device physically approves it**. This
directory implements that approval with the **Ledger Device Management Kit (DMK)** + the Ethereum
signer kit. The signing private key never leaves the device.

> Generation is not permission. The agent can draft a transfer; only a human holding the Ledger can
> release the money — and the policy contract still re-checks every rule even after approval.

## Why this fits the Ledger track

- **Human-in-the-loop for high-risk actions** — large fund movements require explicit device approval.
- **Clear Signing artifact** — `clear-signing/civicshield-pool.erc7730.json` (ERC-7730) makes the
  device screen show *"Approve disaster-relief release · Proposal #5"* instead of raw hex.
- **Concrete primitives** — DMK device sessions + `device-signer-kit-ethereum`, not wallet branding.

## No physical device? Use Speculos (Ledger's emulator)

Everything below runs against **Speculos**, Ledger's official software device — same signing flow, no
hardware. Swap one transport line in `src/dmk.ts` to target a real device later (zero other changes).

### 1. Install
```bash
cd ledger && npm install
```

### 2. Start Speculos (needs Docker running) with the Ethereum app
```bash
# put a Nano S+ Ethereum app binary at ledger/.speculos/ethereum.elf first (see DOCKER notes below)
npm run speculos
```
Speculos serves its API on http://localhost:5000 (the DMK Speculos transport's default).

### 3. Read the Ledger account address
```bash
npm run address
```
Set that address as the pool's `approver` (owner action) and give it a little Base ETH for gas.

### 4. Approve a held release from the Ledger
```bash
npm run approve -- <proposalId>
```
You confirm on the Speculos screen → the device-signed `approveRelease(id)` is broadcast to Base →
`ReleaseApproved` is emitted. Then anyone can call `executeRelease(id)` to pay out.

## Files
- `src/dmk.ts` — DMK instance (Speculos transport; swap to WebHID/node-hid for real hardware)
- `src/approve-release.ts` — connect → get address → sign `approveRelease` → broadcast
- `clear-signing/civicshield-pool.erc7730.json` — Clear Signing descriptor for the pool
- `LEDGER-FEEDBACK.md` — developer-experience feedback on Ledger docs & SDKs (track requirement)
