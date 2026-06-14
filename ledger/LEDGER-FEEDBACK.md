# Ledger developer-experience feedback (DMK + Ethereum signer + Clear Signing)

> Track requirement: feedback on the experience using Ledger docs & SDKs — gaps, confusing flows,
> missing context, and concrete improvements. This is a living doc; fill the TODOs as you build.

## Context
- **What we built:** a human-in-the-loop approver for an AI disaster-relief agent. Large releases are
  held on-chain and require a Ledger to sign `approveRelease(id)` before funds move.
- **SDKs used:** `@ledgerhq/device-management-kit`, `@ledgerhq/device-signer-kit-ethereum`,
  `@ledgerhq/device-transport-kit-speculos`.
- **Tested on:** Speculos emulator (no physical device available at the venue).

## What worked well
- The DMK builder + transport-factory split is clean: targeting Speculos vs. a real device is a
  one-line transport swap, so we could build the whole flow without hardware.
- The `agent-skills` drop-in (`npx skills add ledgerhq/agent-skills`) gave our AI coding assistant
  correct DMK patterns immediately — observable lifecycle, error `_tag` classification, signer API.
- Observable `DeviceActionState` model maps naturally to "show the user what the device is asking."

## Gaps / confusing flows  *(TODO: confirm + screenshot each as you hit it)*
- [ ] **Speculos + DMK getting-started**: docs show the transport factory, but not an end-to-end
      "emulator → DMK → sign an EVM tx → broadcast" example. Had to assemble it ourselves.
- [ ] **Where to get app `.elf` binaries for Speculos** (e.g. the Ethereum app for `--model nanosp`)
      is not linked from the DMK/transport docs — biggest blocker for a no-device demo. TODO: note
      the exact source you used.
- [ ] **`signTransaction` input contract**: docs say "RLP-encoded Uint8Array" but don't state whether
      to pass the EIP-1559 typed envelope (0x02…) or legacy RLP, nor how `v` maps to `yParity` for
      type-2 txs. TODO: confirm which we used and whether the signature verified first try.
- [ ] **Clear Signing (ERC-7730) loop**: unclear how to preview a descriptor on Speculos before
      submitting a PR to the registry, and which `format` values render on which device models.
- [ ] **node-hid native build**: TODO note if `device-transport-kit-node-hid` built cleanly on macOS
      arm64 (we defaulted to Speculos to avoid it).

## Concrete improvements we'd suggest  *(TODO: turn the strongest 1–2 into a docs PR)*
- Add a copy-pasteable "Speculos → sign an EVM transaction → broadcast with viem" tutorial.
- From the DMK docs, link directly to where to obtain app `.elf` files per device model.
- Document the exact `r/s/v → yParity` handling for EIP-1559 in the Ethereum signer reference.

## Contacts / mentors
- TODO: name(s) of Ledger mentor(s) at ETHGlobal NY + anything they clarified.
