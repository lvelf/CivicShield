#!/usr/bin/env bash
# Owner-side prep for the Ledger human-in-the-loop demo. Run ONCE, passing the Ledger/Speculos
# approver address (from `npm run address`). Signed by the owner key (PrivateKey in ../.env).
#
#   ./owner-setup.sh 0xLedgerApproverAddress
#
# It:
#   1. lowers the review threshold to 0.3 USDC (so a small release triggers PENDING_REVIEW)
#   2. temporarily points `agent` at the owner, creates a clean 0.5 USDC proposal, restores the agent
#   3. sets the pool approver to the Ledger/Speculos address
#   4. sends that address a little Base ETH for gas (so it can broadcast approveRelease)
set -euo pipefail

APPROVER="${1:?pass the Ledger/Speculos approver address}"
export PATH="$HOME/.foundry/bin:$PATH"

RPC="https://base.publicnode.com"
POOL="0x8df17313f37f5418868f1c3c369bbde4dba9daa6"
AGENT_PRIVY="0x1D3b8DacD0677A22Ee00739B836ae54109cE44a7"   # restore the Privy agent afterwards
PURPOSE="0xf8a427aba259a77fc9a68254cf15245e67a488cb004cacb4f5d6493a29d0aeed"   # keccak(emergency_shelter)
EVENT="0x57605b3eeaaa73bc8cd897b214c20af20c29404d5b684d3ccda17b6e77d92b08"     # eventId w/ on-chain score 90
PK="0x$(grep '^PrivateKey=' ../.env | cut -d= -f2 | tr -d ' \r\n')"
OWNER="$(cast wallet address --private-key "$PK")"
SEND="cast send --rpc-url $RPC --private-key $PK"

echo "Owner:    $OWNER"
echo "Approver: $APPROVER"

echo "1/4 setReviewThreshold(0.3 USDC)…"
$SEND "$POOL" "setReviewThreshold(uint256)" 300000 >/dev/null

echo "2/4 temp setAgent(owner) → proposeRelease(0.5 USDC) → restore agent…"
$SEND "$POOL" "setAgent(address)" "$OWNER" >/dev/null
$SEND "$POOL" "proposeRelease((address,uint256,bytes32,bytes32,string))" \
  "($OWNER,500000,$PURPOSE,$EVENT,\"Ledger HITL demo: emergency shelter release\")" >/dev/null
$SEND "$POOL" "setAgent(address)" "$AGENT_PRIVY" >/dev/null

echo "3/4 setApprover(Ledger)…"
$SEND "$POOL" "setApprover(address)" "$APPROVER" >/dev/null

echo "4/4 fund approver with gas (0.0004 ETH)…"
$SEND --value 0.0004ether "$APPROVER" >/dev/null

NEWID=$(( $(cast call "$POOL" "proposalCount()(uint256)" --rpc-url $RPC) - 1 ))
echo "✅ Done. New PENDING_REVIEW proposal id = $NEWID"
echo "   Next: npm run approve -- $NEWID   (confirm on the Speculos screen)"
