import type { CapAlert } from '../../cre/src/score.ts'

export type { CapAlert }

/** The assessor sub-agent's structured decision. */
export interface Assessment {
	act: boolean // false => below the bar, do NOT propose (saves gas/compute)
	amountUSDC: number // proposed release size (whole USDC), within the per-event cap
	purpose: string // one of the pool's approved purposes
	reasoning: string // human-readable trail (logged on-chain; never trusted for the decision)
}

/** A proposal ready to submit on-chain. amount is in USDC base units (6 dp). */
export interface DraftProposal {
	recipient: `0x${string}`
	amount: bigint
	purpose: string
	eventId: `0x${string}`
	reasoning: string
}
