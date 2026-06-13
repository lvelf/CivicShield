链: Base Mainnet (chainId 8453)
RPC: https://mainnet.base.org
CivicShieldPool: 0x5e9972027d4f03824ac0e5da446f0afb5bfffcf5
USDC (真实Circle): 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

ABI + 地址打包好了: contracts/deployments/base-mainnet.json (直接 import)
函数说明: docs/INTERFACES.md
浏览器: https://basescan.org/address/0x5e9972027d4f03824ac0e5da446f0afb5bfffcf5

前端要做的:
- Transparency Log: 读 ActionEvaluated 事件
- 提案列表: getProposal(id) / proposalCount()
- 策略展示: policy() / isVerifiedRecipient() / isApprovedPurpose()
- 捐款: LI.FI Composer contractCalls -> donate(uint256), 落点就是上面这个池子
  (Composer 已验证可用, 参考 tx 0x75ed2d4d... 和 docs/lifi-composer-findings.md)

注意: LI.FI Composer 只支持主网, 所以捐款这块在 Base 主网演, 不是测试网。