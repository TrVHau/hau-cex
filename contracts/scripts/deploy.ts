/**
 * scripts/deploy.ts — Deploy ExchangeVault, MockERC20 (USDT + USDC), TokenFaucet
 *
 * Cách chạy:
 *   # Localhost (cần `pnpm node` đang chạy)
 *   pnpm hardhat run scripts/deploy.ts --network localhost
 *
 *   # Sepolia testnet
 *   PRIVATE_KEY=0x... SEPOLIA_RPC_URL=https://... pnpm hardhat run scripts/deploy.ts --network sepolia
 *
 *   # BSC Testnet
 *   PRIVATE_KEY=0x... pnpm hardhat run scripts/deploy.ts --network bscTestnet
 *
 * Sau khi deploy, địa chỉ contract được in ra console và ghi vào
 *   deployments/<network>.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { HardhatRuntimeEnvironment } from "hardhat/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── Token configs ───────────────────────────────────────────────────────────
interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  /** Faucet claim amount tính theo đơn vị nhỏ nhất */
  faucetClaimAmount: bigint;
  /** Cooldown giữa 2 lần claim (giây) */
  faucetCooldown: bigint;
}

const TOKEN_CONFIGS: TokenConfig[] = [
  {
    name: "Mock USDT",
    symbol: "USDT",
    decimals: 6,
    faucetClaimAmount: 1_000n * 10n ** 6n,   // 1,000 USDT
    faucetCooldown: 86_400n,                   // 1 ngày
  },
  {
    name: "Mock USDC",
    symbol: "USDC",
    decimals: 6,
    faucetClaimAmount: 1_000n * 10n ** 6n,   // 1,000 USDC
    faucetCooldown: 86_400n,                   // 1 ngày
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────
async function main(hre: HardhatRuntimeEnvironment): Promise<void> {
  const conn    = await hre.network.getOrCreate();
  const ethers  = conn.ethers;
  const [deployer] = await ethers.getSigners();

  const network    = conn.networkName;
  const deployerAddr = await deployer.getAddress();
  const balance      = await ethers.provider.getBalance(deployerAddr);

  console.log("\n══════════════════════════════════════════");
  console.log(` Network  : ${network}`);
  console.log(` Deployer : ${deployerAddr}`);
  console.log(` Balance  : ${ethers.formatEther(balance)} ETH`);
  console.log("══════════════════════════════════════════\n");

  // ─── 1. Deploy MockERC20 tokens ───────────────────────────────────────────
  const MockERC20 = await ethers.getContractFactory("MockERC20", deployer);
  const tokenAddresses: Record<string, string> = {};

  for (const cfg of TOKEN_CONFIGS) {
    process.stdout.write(`Deploying MockERC20 (${cfg.symbol})…`);
    const token = await MockERC20.deploy(cfg.name, cfg.symbol, cfg.decimals, deployerAddr);
    await token.waitForDeployment();
    const addr = await token.getAddress();
    tokenAddresses[cfg.symbol] = addr;
    console.log(` ✓  ${addr}`);
  }

  // ─── 2. Deploy TokenFaucet ────────────────────────────────────────────────
  process.stdout.write("Deploying TokenFaucet…");
  const TokenFaucet = await ethers.getContractFactory("TokenFaucet", deployer);
  const faucet      = await TokenFaucet.deploy(deployerAddr);
  await faucet.waitForDeployment();
  const faucetAddr = await faucet.getAddress();
  console.log(` ✓  ${faucetAddr}`);

  // ─── 3. Grant MINTER_ROLE cho Faucet trên mỗi token ─────────────────────
  console.log("\nConfiguring tokens…");
  for (const cfg of TOKEN_CONFIGS) {
    const tokenAddr = tokenAddresses[cfg.symbol]!;
    const token     = MockERC20.attach(tokenAddr);

    // Grant minter role to faucet
    const MINTER_ROLE = await (token as any).MINTER_ROLE() as string;
    const tx1 = await (token as any).grantRole(MINTER_ROLE, faucetAddr);
    await (tx1 as any).wait();

    // Configure faucet for this token
    const tx2 = await (faucet as any).setTokenConfig(
      tokenAddr,
      true,
      cfg.faucetClaimAmount,
      cfg.faucetCooldown,
    );
    await (tx2 as any).wait();

    console.log(`  ${cfg.symbol} (${tokenAddr})`);
    console.log(`    MINTER_ROLE → Faucet ✓`);
    console.log(`    Claim: ${cfg.faucetClaimAmount / 10n ** BigInt(cfg.decimals)} ${cfg.symbol} / ${Number(cfg.faucetCooldown) / 3600}h ✓`);
  }

  // ─── 4. Deploy ExchangeVault ──────────────────────────────────────────────
  process.stdout.write("\nDeploying ExchangeVault…");
  const ExchangeVault = await ethers.getContractFactory("ExchangeVault", deployer);
  const vault         = await ExchangeVault.deploy(deployerAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(` ✓  ${vaultAddr}`);

  // ─── 5. Kích hoạt token trên Vault ───────────────────────────────────────
  console.log("\nEnabling tokens on ExchangeVault…");
  for (const [symbol, tokenAddr] of Object.entries(tokenAddresses)) {
    const tx = await (vault as any).setSupportedToken(tokenAddr, true);
    await (tx as any).wait();
    console.log(`  ${symbol} (${tokenAddr}) ✓`);
  }

  // ─── 6. Ghi deployment record ─────────────────────────────────────────────
  const record = {
    network,
    deployedAt: new Date().toISOString(),
    deployer: deployerAddr,
    contracts: {
      ExchangeVault: vaultAddr,
      TokenFaucet: faucetAddr,
      tokens: tokenAddresses,
    },
  };

  const deploymentsDir = join(__dirname, "..", "deployments");
  mkdirSync(deploymentsDir, { recursive: true });
  const outPath = join(deploymentsDir, `${network}.json`);
  writeFileSync(outPath, JSON.stringify(record, null, 2) + "\n");

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  console.log(" Deployment Summary");
  console.log("══════════════════════════════════════════");
  console.log(` ExchangeVault : ${vaultAddr}`);
  console.log(` TokenFaucet   : ${faucetAddr}`);
  for (const [symbol, addr] of Object.entries(tokenAddresses)) {
    console.log(` ${symbol.padEnd(13)}: ${addr}`);
  }
  console.log(`\n Saved → deployments/${network}.json`);
  console.log("══════════════════════════════════════════\n");
}

// ─── Entry point ─────────────────────────────────────────────────────────────
// Hardhat 3: import hre từ "hardhat" sau khi config được load
const { default: hre } = await import("hardhat") as { default: HardhatRuntimeEnvironment };
await main(hre);
