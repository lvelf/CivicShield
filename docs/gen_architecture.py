"""Regenerates docs/architecture.png in the original dark/rounded-box style, aligned to the
current framework (multi-agent + Privy, CRE + relayer, Ledger review tier, 6-rule policy)."""
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

BG = "#000000"
GRAY = ("#edeae6", "#262626")
TEAL = ("#cdeae3", "#0f6b5f")
CORAL = ("#f8ddd9", "#b3402f")
GREEN = ("#d8efd2", "#2f7d2a")
RED = ("#f8d6d6", "#b32f2f")
INDIGO = ("#dfe0fb", "#3b3a9e")
WHITE = ("#ffffff", "#262626")
SUB = "#7a7a7a"

fig, ax = plt.subplots(figsize=(11, 12))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis("off")


def box(x, y, w, h, fill, title, sub="", tsize=13, ssize=9.5, title_dy=None):
    fc, tc = fill
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.6,rounding_size=1.6",
                                facecolor=fc, edgecolor="none", mutation_aspect=1))
    cx = x + w / 2
    if sub:
        ax.text(cx, y + h * 0.62, title, ha="center", va="center", fontsize=tsize,
                fontweight="bold", color=tc)
        ax.text(cx, y + h * 0.30, sub, ha="center", va="center", fontsize=ssize, color=SUB)
    else:
        ax.text(cx, y + h / 2, title, ha="center", va="center", fontsize=tsize,
                fontweight="bold", color=tc)


def arrow(x1, y1, x2, y2, color="#888888", lw=1.6):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="-|>", color=color, lw=lw, shrinkA=2, shrinkB=2))


# Row 1 — inputs (top)
box(6, 90, 30, 7, GRAY, "Donors", "any chain · any token")
box(52, 90, 42, 7, GRAY, "LI.FI Composer", "swap → USDC → donate()  ·  one signature")
arrow(36, 93.5, 52, 93.5)

# Row 2 — oracle + AI proposer
box(4, 76, 42, 8, GRAY, "Chainlink CRE workflow", "api.weather.gov → riskScore → relayer")
box(52, 75.5, 44, 9, CORAL, "Multi-agent proposer (AI)",
    "supervisor → assessor (OpenAI) · Privy wallet\nproposeRelease()  ·  GitHub Actions cron", ssize=9)

# Pool (trust core)
box(6, 47, 88, 21, TEAL, "", "")
ax.text(50, 65.2, "CivicShieldPool  —  escrow on Base mainnet", ha="center", va="center",
        fontsize=14, fontweight="bold", color=TEAL[1])
ax.text(50, 62.4, "the only entity that moves funds", ha="center", va="center", fontsize=9.5, color="#4f8c82")
# nested policy box
box(11, 49, 78, 11, WHITE, "", "")
ax.text(50, 57.2, "Policy Π  —  deterministic certification (6 rules, first failure wins)",
        ha="center", va="center", fontsize=11, fontweight="bold", color="#262626")
ax.text(50, 53.7, "0 scope (donor intent)   ·   1 risk ≥ 75   ·   2 amount ≤ cap",
        ha="center", va="center", fontsize=9.5, color="#555555")
ax.text(50, 51.2, "3 daily limit (trace)   ·   4 verified recipient   ·   5 approved purpose",
        ha="center", va="center", fontsize=9.5, color="#555555")

# inputs -> pool
arrow(73, 90, 73, 68)          # composer
arrow(20, 76, 20, 68)          # CRE
arrow(74, 75.5, 60, 68, color="#b3402f")  # agent proposeRelease

# Row 4 — outcomes
box(4, 30, 28, 8, GREEN, "shelter-fund.eth", "executeRelease() · ENS-verified", ssize=9)
box(37, 30, 26, 8, INDIGO, "Ledger approval", "approveRelease() · large $", ssize=9)
box(68, 30, 28, 8, RED, "Blocked", "attack logged on-chain", ssize=9)

arrow(30, 47, 18, 38, color="#2f7d2a")   # release
arrow(50, 47, 50, 38, color="#3b3a9e")   # >= threshold -> review
arrow(70, 47, 82, 38, color="#b32f2f")   # blocked
ax.text(40.5, 43, "release", fontsize=8, color="#2f7d2a", ha="center")
ax.text(53.5, 43, "≥ reviewThreshold", fontsize=8, color="#3b3a9e", ha="left")
# Ledger approves -> release path back to recipient
arrow(43, 30, 28, 30, color="#3b3a9e", lw=1.3)

# Row 5 — transparency log
box(26, 15, 48, 7, GRAY, "Transparency log", "every outcome auditable on-chain (ActionEvaluated)")
arrow(16, 30, 34, 22, color="#2f7d2a")
arrow(82, 30, 66, 22, color="#b32f2f")

# legend + tagline
ax.text(50, 9, "coral = AI (proposes only)   ·   teal = on-chain trust core   ·   "
        "green / red = released / blocked   ·   indigo = Ledger human gate",
        ha="center", va="center", fontsize=8.5, color="#6f6f6f")
ax.text(50, 4.5, "Generation is not permission: the agent can propose a release,\n"
        "but only the CivicShieldPool can certify and execute it.",
        ha="center", va="center", fontsize=9.5, color="#5a5a5a", style="italic")

plt.savefig("docs/architecture.png", dpi=150, facecolor=BG, bbox_inches="tight", pad_inches=0.3)
print("wrote docs/architecture.png")
