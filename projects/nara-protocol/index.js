const ADDRESSES = require('../helper/coreAssets.json')
const { sumTokens2, nullAddress } = require('../helper/unwrapLPs')

// Canonical NARA V5 & CryptoSLIP V3.2 Base Mainnet (Chain ID 8453) contracts
const NARA_TOKEN = '0x91FB78A9F46B67f54BbD4489941d19666b2fAe0f'
const BASE_USDC = ADDRESSES.base.USDC // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
const BASE_WETH = ADDRESSES.base.WETH // 0x4200000000000000000000000000000000000006
const BASE_CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'

// User principal & voucher custody (Staking when asset == NARA; TVL when asset == ETH/USDC/WETH/cbBTC)
const NARA_PRINCIPAL_LEDGER_V5 = '0x7F866a9fbe41D54F0d9C35b6892fcf27Ea766DB2'
const CRYPTOSLIP_VAULT_V32 = '0x38BF0321FA7489576978353a6a8da4A3e85C2F18'

// Non-NARA protocol fee, reward, sale escrow & range liquidity custody
const NARA_REWARD_LEDGER_V5 = '0xC72671D9438388638547444524F6542b650C9264'
const NARA_REWARD_INGRESS_V5 = '0x44130CC47b886D8488041F5eaE271477D1aFA909'
const NARA_FEE_VAULT_V5 = '0xe63b4BaAF873FC57859bfe13e0e8cFccAaB6AddE'
const NARA_POSITION_SALE_V5 = '0xef99081Ce6B150A0BaF109822C12D96EE4eC3fb4'
const NARA_TREASURY_RANGE_MANAGER_V5 = '0xa72557fcBE56B3eC739dF3aF7b6b893B6Db4D288'

const FEE_VAULT_INVENTORY_ABI =
  'function inventory(uint8 asset) view returns ((uint256 holderClaims, uint256 polClaims, uint256 holderRaw, uint256 polRaw, uint256 hookFees, uint256 lpFees, uint256 claimsRedeemed, uint256 holdersForwarded, uint256 polDonations, uint256 polReturned, uint256 polSpent) booked, uint256 rawBalance, uint256 claimBalance, uint256 rawSurplus, uint256 claimSurplus, bool solvent)'

async function tvl(api) {
  // 1. Account for Uniswap v4 PoolManager ERC-6909 USDC claim tokens held by NARAFeeVaultV5 (RewardAsset.USDC = 2)
  const usdcInventory = await api.call({
    target: NARA_FEE_VAULT_V5,
    params: [2],
    abi: FEE_VAULT_INVENTORY_ABI,
    permitFailure: true,
  })
  if (usdcInventory && usdcInventory.claimBalance) {
    api.add(BASE_USDC, usdcInventory.claimBalance)
  }

  // 2. Sum direct non-NARA balances (ETH, USDC, WETH, cbBTC) across V5 custody contracts
  return sumTokens2({
    api,
    owners: [
      NARA_REWARD_LEDGER_V5,
      NARA_REWARD_INGRESS_V5,
      NARA_FEE_VAULT_V5,
      NARA_POSITION_SALE_V5,
      NARA_TREASURY_RANGE_MANAGER_V5,
      CRYPTOSLIP_VAULT_V32,
    ],
    tokens: [nullAddress, BASE_USDC, BASE_WETH, BASE_CBBTC],
    blacklistedTokens: [NARA_TOKEN],
  })
}

async function staking(api) {
  // User-locked NARA in NARAPrincipalLedgerV5 (1d-365d Position NFTs) and active NARA vouchers in CryptoSlipVaultV32.
  // Note: Unissued emission reserves in NARAEmissionReserveV5 (0xf932178F24b0813C82093985F0Af6Db27Ae25930)
  // are intentionally excluded per DefiLlama guidelines.
  return sumTokens2({
    api,
    owners: [NARA_PRINCIPAL_LEDGER_V5, CRYPTOSLIP_VAULT_V32],
    tokens: [NARA_TOKEN],
  })
}

module.exports = {
  methodology:
    'TVL counts non-NARA assets (USDC, ETH, WETH, cbBTC) held in NARARewardLedgerV5, NARARewardIngressV5, NARAFeeVaultV5 (including Uniswap v4 PoolManager ERC-6909 USDC claims), NARAPositionSaleV5 escrow, NARATreasuryRangeManagerV5, and CryptoSlipVaultV32. Staking counts user-locked NARA principal in NARAPrincipalLedgerV5 and active NARA slips in CryptoSlipVaultV32, excluding unissued protocol emission reserves.',
  start: 53409500, // Base Mainnet deployment block (2026-11-02)
  base: {
    tvl,
    staking,
  },
}
