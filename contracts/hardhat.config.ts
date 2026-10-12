import type { HardhatUserConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

// ─── Env ─────────────────────────────────────────────────────────────────────
// Đọc từ .env ở root workspace (../../.env)
const PRIVATE_KEY  = process.env["PRIVATE_KEY"]  ?? "";
const SEPOLIA_URL  = process.env["SEPOLIA_RPC_URL"] || process.env["RPC_URL"] || "https://rpc.sepolia.org";
const BSC_TEST_URL = process.env["BSC_TESTNET_RPC_URL"] || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";

const config: HardhatUserConfig = {
  plugins: [hardhatEthers],

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    // ── Cục bộ ──────────────────────────────────────────────────────────────
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // ── Testnets ─────────────────────────────────────────────────────────────
    sepolia: {
      type: "http",
      url: SEPOLIA_URL,
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    bscTestnet: {
      type: "http",
      url: BSC_TEST_URL,
      chainId: 97,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
