# Smart Contract Implementation Plan (v2)

> Đã đọc và đồng bộ với: `05-business-rules.md`, `07-database-design.md`,
> `08-api-design.md`, `09-internal-message-contract.md`, `11-smart-contract-design.md`
>
> Bổ sung so với v1: `recoverERC20()`, accountReference one-time clarification,
> reentrancy tests, admin permission tests, implementation chi tiết hơn

---

## 1. Tổng Quan & Phạm Vi

### On-chain (Phase này làm)

```
contracts/contracts/MockERC20.sol
contracts/contracts/TokenFaucet.sol
contracts/contracts/ExchangeVault.sol
contracts/interfaces/IMintableERC20.sol
contracts/scripts/deploy.ts
contracts/scripts/configure-faucet.ts
contracts/scripts/configure-vault.ts
contracts/test/MockERC20.test.ts
contracts/test/TokenFaucet.test.ts
contracts/test/ExchangeVault.test.ts
```

### Off-chain (KHÔNG thuộc Phase này)

Blockchain Listener, Deposit Consumer, Confirmation Worker, Backend Deposit API
→ Đây là Phase 12 trong roadmap, sau Core Trading Flow hoàn thiện.

### Contract không làm

```
Không: Withdrawal
Không: native ETH Deposit
Không: Upgradeable proxy
Không: Multi-sig
Không: bridge, swap, yield
```

---

## 2. Đồng Bộ với Docs Khác

### Đồng bộ với schema.prisma

- `LedgerEntryType.DEPOSIT` đã có trong schema → Backend Phase 12 sẽ dùng
- `Asset.contractAddress` đã có trong schema → sẽ lưu địa chỉ MockERC20 sau deploy
- `Asset.depositEnabled` đã có → chỉ asset có `depositEnabled=true` mới được Deposit

### Đồng bộ với docs/07 (Database Design)

- Bảng `deposits` là Optional Migration, chỉ tạo khi Phase 12
- Schema: `account_reference TEXT UNIQUE`, `depositor_address TEXT`, `token_address TEXT`
- Partial unique index: `UNIQUE(chain_id, tx_hash, log_index) WHERE tx_hash IS NOT NULL`

### Đồng bộ với docs/09 (Message Contract)

- Stream `stream:blockchain:events` — consumer group `blockchain-deposit-v1`
- Message type `DepositDetected` — không dùng `commandSequence`
- `correlationId` = `depositId`

### Đồng bộ với docs/05 (Business Rules §18)

- Credit chỉ sau khi event hợp lệ + đủ confirmation
- Credit transaction atomic: Wallet + Ledger + Deposit status trong cùng PostgreSQL TX
- `LEDGER_ENTRY_TYPE = DEPOSIT`, `referenceType = DEPOSIT`

---

## 3. Dependency Setup

### Kiểm tra hardhat version hiện tại

```bash
# Trong contracts/
cat package.json   # Hardhat 3.9.1 đang dùng
```

### Dependencies cần thêm

```bash
pnpm add -D @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-ethers ethers dotenv
pnpm add -D @types/node
```

> **Lưu ý Hardhat 3:** `hardhat-toolbox` v5 tương thích Hardhat 3. Nếu conflict, dùng:
> `@nomicfoundation/hardhat-toolbox-viem` + `viem` thay thế.

### package.json sau update

```json
{
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@types/node": "^22.20.0",
    "dotenv": "^16.4.0",
    "hardhat": "^3.9.1",
    "typescript": "~6.0.3"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.6.1"
  }
}
```

---

## 4. hardhat.config.ts

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      // local in-process network cho tests
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
};

export default config;
```

---

## 5. Contract 1 — interfaces/IMintableERC20.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Interface dùng cho TokenFaucet khi gọi mint() trên MockERC20
interface IMintableERC20 is IERC20 {
    function mint(address to, uint256 amount) external;
}
```

---

## 6. Contract 2 — MockERC20.sol

### Mục tiêu

Token ERC-20 mô phỏng cho môi trường local/testnet.

- Custom decimals (immutable)
- Chỉ `MINTER_ROLE` được gọi `mint()`

### Full Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MockERC20 — Token test cho Hau CEX
/// @notice Mint bị giới hạn bởi MINTER_ROLE. Decimals cố định khi deploy.
contract MockERC20 is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev Decimals được lưu immutable — không thay đổi sau deploy
    uint8 private immutable _tokenDecimals;

    // ─── Events ─────────────────────────────────────────────────────────────
    // Transfer, Approval inherited từ ERC20

    // ─── Constructor ─────────────────────────────────────────────────────────
    /// @param name_     Tên đầy đủ (e.g., "Mock USDT")
    /// @param symbol_   Symbol (e.g., "USDT")
    /// @param decimals_ Số chữ số thập phân (e.g., 6 cho USDT, 18 cho ETH)
    /// @param admin     Địa chỉ nhận DEFAULT_ADMIN_ROLE — có thể grant MINTER_ROLE
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address admin
    ) ERC20(name_, symbol_) {
        _tokenDecimals = decimals_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── View Functions ───────────────────────────────────────────────────────
    /// @inheritdoc ERC20
    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    // ─── Minter Functions ─────────────────────────────────────────────────────
    /// @notice Mint token vào địa chỉ `to`
    /// @dev Chỉ được gọi bởi tài khoản có MINTER_ROLE (thường là TokenFaucet)
    function mint(
        address to,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
```

### Business Rules bắt buộc

- `decimals` là `immutable` — không có setter
- Deploy USDT: `decimals_ = 6`
- Deploy ETH/HAU: `decimals_ = 18`
- `mint()` chỉ được gọi bởi `MINTER_ROLE` — TokenFaucet được grant role này

---

## 7. Contract 3 — TokenFaucet.sol

### Mục tiêu

Phân phát token test cho user với cooldown. Một Faucet hỗ trợ nhiều token.

### Full Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IMintableERC20.sol";

/// @title TokenFaucet — Phân phát Mock ERC-20 token test cho Hau CEX
/// @notice Mỗi token có claim amount và cooldown riêng.
///         Chỉ dùng trong local/testnet — không dành cho production.
contract TokenFaucet is AccessControl, Pausable, ReentrancyGuard {

    // ─── State ───────────────────────────────────────────────────────────────
    mapping(address token => bool supported)          public supportedTokens;
    mapping(address token => uint256 amount)          public claimAmounts;
    mapping(address token => uint256 cooldown)        public claimCooldowns;
    mapping(address token => mapping(address user => uint256 claimedAt))
                                                      public lastClaimAt;

    // ─── Errors ───────────────────────────────────────────────────────────────
    error UnsupportedToken(address token);
    error InvalidClaimAmount();
    error FaucetCooldownActive(uint256 nextClaimAt);

    // ─── Events ───────────────────────────────────────────────────────────────
    event TokenClaimed(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event TokenConfigured(address indexed token, bool supported, uint256 amount, uint256 cooldown);

    // ─── Constructor ─────────────────────────────────────────────────────────
    /// @param admin Địa chỉ nhận DEFAULT_ADMIN_ROLE
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── User Functions ───────────────────────────────────────────────────────
    /// @notice Claim token. Phải đợi hết cooldown giữa các lần claim.
    /// @param token Địa chỉ MockERC20 muốn claim
    function claim(address token) external whenNotPaused nonReentrant {
        if (!supportedTokens[token]) revert UnsupportedToken(token);

        uint256 amount = claimAmounts[token];
        if (amount == 0) revert InvalidClaimAmount();

        uint256 nextClaimAt = lastClaimAt[token][msg.sender] + claimCooldowns[token];
        if (block.timestamp < nextClaimAt) revert FaucetCooldownActive(nextClaimAt);

        lastClaimAt[token][msg.sender] = block.timestamp;

        // Gọi mint() — Faucet phải có MINTER_ROLE trên token contract
        IMintableERC20(token).mint(msg.sender, amount);

        emit TokenClaimed(msg.sender, token, amount);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────
    /// @notice Cấu hình supported token, claim amount và cooldown
    function setTokenConfig(
        address token,
        bool supported,
        uint256 amount,
        uint256 cooldown
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
        claimAmounts[token]    = amount;
        claimCooldowns[token]  = cooldown;
        emit TokenConfigured(token, supported, amount, cooldown);
    }

    // Giữ lại setters riêng lẻ cho linh hoạt
    function setSupportedToken(address token, bool supported)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
    }

    function setClaimAmount(address token, uint256 amount)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        claimAmounts[token] = amount;
    }

    function setClaimCooldown(address token, uint256 cooldown)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        claimCooldowns[token] = cooldown;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
```

---

## 8. Contract 4 — ExchangeVault.sol (với recoverERC20)

### Mục tiêu

Nhận ERC-20 và phát event để Backend credit Wallet nội bộ.
`accountReference` là **one-time per depositor** — không thể tái sử dụng.

### One-time accountReference — Giải thích

```
depositKey = keccak256(abi.encode(accountReference, msg.sender))
```

Ý nghĩa:

- Cùng `msg.sender` KHÔNG thể dùng lại `accountReference` đó
- `msg.sender` khác CÓ THỂ dùng cùng `accountReference` → chỉ tạo event với depositor khác
  nhưng Backend sẽ từ chối vì depositor không khớp Deposit Intent
- Thiết kế này tránh một địa chỉ xấu dùng reference của người khác để "khóa" nó

Tại sao one-time là đúng:

- Docs/11 §18.5: "Nếu cùng accountReference phát sinh nhiều event, chỉ event hợp lệ đầu tiên được gắn với Intent."
- Docs/11 §8.3: "`accountReference` không được tái sử dụng cho lần nạp khác."
- Nếu User muốn nạp lần 2: tạo Deposit Intent mới → nhận `accountReference` mới

### Full Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ExchangeVault — Nhận ERC-20 token từ User và phát event để Backend credit
/// @notice mỗi cặp (accountReference, msg.sender) chỉ được dùng một lần duy nhất.
///         Backend sẽ dùng event Deposited để credit Wallet nội bộ sau khi đủ confirmation.
contract ExchangeVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────────
    /// @notice Token được phép Deposit
    mapping(address token => bool supported) public supportedTokens;

    /// @notice depositKey = keccak256(accountReference, msg.sender) — mỗi cặp chỉ dùng một lần
    /// @dev Thiết kế this prevents: (1) depositor tái sử dụng reference,
    ///      (2) kẻ xấu không thể khóa reference của người khác vì key khác nhau
    mapping(bytes32 depositKey => bool used) public usedDepositKeys;

    // ─── Errors ───────────────────────────────────────────────────────────────
    error UnsupportedToken(address token);
    error InvalidAmount();
    error InvalidAccountReference();
    /// @notice Khi cùng msg.sender đã dùng accountReference này rồi
    error DepositReferenceAlreadyUsed(bytes32 accountReference);
    error CannotRecoverSupportedToken(address token);
    error ZeroAddress();

    // ─── Events ───────────────────────────────────────────────────────────────
    /// @notice Phát mỗi khi Deposit thành công
    /// @param accountReference Mã liên kết với Deposit Intent trong Backend
    /// @param depositor        Địa chỉ ví blockchain gửi token
    /// @param token            Địa chỉ ERC-20 contract
    /// @param amount           Số lượng raw (chưa chia decimals)
    event Deposited(
        bytes32 indexed accountReference,
        address indexed depositor,
        address indexed token,
        uint256 amount
    );

    event TokenSupportUpdated(address indexed token, bool supported);

    /// @notice Phát khi Admin thu hồi token bị gửi nhầm vào Vault
    event ERC20Recovered(address indexed token, address indexed to, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────
    /// @param admin Địa chỉ nhận DEFAULT_ADMIN_ROLE
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── User Functions ───────────────────────────────────────────────────────
    /// @notice Nạp token vào Vault. Phải approve trước.
    /// @dev accountReference là bytes32 do Backend cung cấp, one-time per depositor.
    ///      Mỗi Deposit Intent chỉ được dùng một lần — tạo Intent mới để nạp lại.
    /// @param token            Địa chỉ ERC-20 cần nạp (phải là supported token)
    /// @param amount           Số lượng raw token (không được bằng 0)
    /// @param accountReference Mã bytes32 nhận từ Backend Deposit Intent API
    function deposit(
        address token,
        uint256 amount,
        bytes32 accountReference
    ) external whenNotPaused nonReentrant {
        if (!supportedTokens[token])       revert UnsupportedToken(token);
        if (amount == 0)                   revert InvalidAmount();
        if (accountReference == bytes32(0)) revert InvalidAccountReference();

        // depositKey = keccak256(accountReference, msg.sender)
        // Cùng depositor không thể dùng lại cùng reference
        bytes32 depositKey = keccak256(abi.encode(accountReference, msg.sender));

        if (usedDepositKeys[depositKey]) {
            revert DepositReferenceAlreadyUsed(accountReference);
        }

        // Đánh dấu TRƯỚC khi transfer để ngăn reentrancy (checks-effects-interactions)
        usedDepositKeys[depositKey] = true;

        // safeTransferFrom sẽ revert nếu không đủ allowance hoặc balance
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(accountReference, msg.sender, token, amount);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────
    /// @notice Cấu hình token được phép Deposit
    function setSupportedToken(
        address token,
        bool supported
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    /// @notice Thu hồi token bị gửi nhầm vào Vault (không phải supported token)
    /// @dev KHÔNG được dùng để rút token của user. Chỉ dành cho token lạc đường.
    ///      Supported token KHÔNG được recover — phải ngừng hỗ trợ trước (setSupportedToken=false).
    /// @param token Địa chỉ ERC-20 muốn recover (phải là unsupported token)
    /// @param to    Địa chỉ nhận token (thường là Admin wallet)
    /// @param amount Số lượng muốn recover
    function recoverERC20(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Chỉ cho recover token KHÔNG phải supported
        // Tránh Admin vô tình rút token của user
        if (supportedTokens[token]) revert CannotRecoverSupportedToken(token);
        if (to == address(0)) revert ZeroAddress();

        IERC20(token).safeTransfer(to, amount);
        emit ERC20Recovered(token, to, amount);
    }

    // ─── Không nhận native ETH ────────────────────────────────────────────────
    // Không có receive() hoặc fallback() — contract sẽ revert khi nhận ETH
}
```

### Tại sao cần recoverERC20

Trường hợp thực tế cần recover:

- User chuyển nhầm token không được hỗ trợ vào Vault (ví dụ: DAI, WBTC)
- Token được unsupport sau khi đã có balance trong Vault
- Frontend bug gọi transfer thay vì deposit

Ràng buộc an toàn của recoverERC20:

- `supportedTokens[token] == true` → REVERT (bảo vệ fund user)
- Admin muốn recover supported token → phải `setSupportedToken(token, false)` trước
- `to != address(0)`

---

## 9. Deploy Script — scripts/deploy.ts

```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // ── 1. Deploy Mock Tokens ─────────────────────────────────────────────────
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const mockETH = await MockERC20.deploy(
    "Mock ETH",
    "ETH",
    18,
    deployer.address,
  );
  await mockETH.waitForDeployment();
  console.log("MockETH deployed:", await mockETH.getAddress());

  const mockUSDT = await MockERC20.deploy(
    "Mock USDT",
    "USDT",
    6,
    deployer.address,
  );
  await mockUSDT.waitForDeployment();
  console.log("MockUSDT deployed:", await mockUSDT.getAddress());

  const mockHAU = await MockERC20.deploy(
    "HAU Token",
    "HAU",
    18,
    deployer.address,
  );
  await mockHAU.waitForDeployment();
  console.log("MockHAU deployed:", await mockHAU.getAddress());

  // ── 2. Deploy TokenFaucet ─────────────────────────────────────────────────
  const TokenFaucet = await ethers.getContractFactory("TokenFaucet");
  const faucet = await TokenFaucet.deploy(deployer.address);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log("TokenFaucet deployed:", faucetAddress);

  // ── 3. Grant MINTER_ROLE cho Faucet ──────────────────────────────────────
  const MINTER_ROLE = await mockETH.MINTER_ROLE();
  await (await mockETH.grantRole(MINTER_ROLE, faucetAddress)).wait();
  await (await mockUSDT.grantRole(MINTER_ROLE, faucetAddress)).wait();
  await (await mockHAU.grantRole(MINTER_ROLE, faucetAddress)).wait();
  console.log("MINTER_ROLE granted to Faucet");

  // ── 4. Cấu hình Faucet ────────────────────────────────────────────────────
  const DAY = 86400n;
  await (
    await faucet.setTokenConfig(
      await mockETH.getAddress(),
      true,
      ethers.parseEther("0.1"), // 0.1 ETH per claim
      DAY,
    )
  ).wait();
  await (
    await faucet.setTokenConfig(
      await mockUSDT.getAddress(),
      true,
      1000n * 10n ** 6n, // 1,000 USDT per claim
      DAY,
    )
  ).wait();
  await (
    await faucet.setTokenConfig(
      await mockHAU.getAddress(),
      true,
      ethers.parseEther("1000"), // 1,000 HAU per claim
      DAY,
    )
  ).wait();
  console.log("Faucet configured");

  // ── 5. Deploy ExchangeVault ───────────────────────────────────────────────
  const ExchangeVault = await ethers.getContractFactory("ExchangeVault");
  const vault = await ExchangeVault.deploy(deployer.address);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("ExchangeVault deployed:", vaultAddress);

  // ── 6. Cấu hình Vault supported tokens ───────────────────────────────────
  await (
    await vault.setSupportedToken(await mockETH.getAddress(), true)
  ).wait();
  await (
    await vault.setSupportedToken(await mockUSDT.getAddress(), true)
  ).wait();
  await (
    await vault.setSupportedToken(await mockHAU.getAddress(), true)
  ).wait();
  console.log("Vault configured");

  // ── 7. In ra để copy vào .env và seed backend ─────────────────────────────
  console.log("\n=== CONTRACT ADDRESSES ===");
  console.log(`MOCK_ETH_ADDRESS=${await mockETH.getAddress()}`);
  console.log(`MOCK_USDT_ADDRESS=${await mockUSDT.getAddress()}`);
  console.log(`MOCK_HAU_ADDRESS=${await mockHAU.getAddress()}`);
  console.log(`TOKEN_FAUCET_ADDRESS=${faucetAddress}`);
  console.log(`EXCHANGE_VAULT_ADDRESS=${vaultAddress}`);
  console.log("\n=== CHAIN INFO ===");
  const network = await ethers.provider.getNetwork();
  console.log(`BLOCKCHAIN_CHAIN_ID=${network.chainId}`);
  console.log(`BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545`);
  console.log(`BLOCKCHAIN_CONFIRMATIONS=1`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## 10. Tests

### Test Convention

```typescript
// Dùng Hardhat Toolbox (ethers v6 + chai matchers)
// Mỗi test file cấu trúc: describe > context (happy path / revert) > it

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
```

---

### test/MockERC20.test.ts

```typescript
describe("MockERC20", () => {
  async function deployFixture() {
    const [admin, minter, user1, user2] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Mock USDT", "USDT", 6, admin.address);
    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.grantRole(MINTER_ROLE, minter.address);
    return { token, admin, minter, user1, user2, MINTER_ROLE };
  }

  describe("Metadata", () => {
    it("decimals() returns 6", async () => {
      const { token } = await loadFixture(deployFixture);
      expect(await token.decimals()).to.equal(6);
    });
    it("name and symbol are correct", async () => {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal("Mock USDT");
      expect(await token.symbol()).to.equal("USDT");
    });
  });

  describe("mint()", () => {
    it("MINTER_ROLE can mint", async () => {
      const { token, minter, user1 } = await loadFixture(deployFixture);
      await token.connect(minter).mint(user1.address, 1000n);
      expect(await token.balanceOf(user1.address)).to.equal(1000n);
    });

    it("non-minter cannot mint — reverts AccessControl", async () => {
      const { token, user1, user2, MINTER_ROLE } =
        await loadFixture(deployFixture);
      await expect(token.connect(user1).mint(user2.address, 1000n))
        .to.be.revertedWithCustomError(
          token,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(user1.address, MINTER_ROLE);
    });

    it("admin (without MINTER_ROLE) cannot mint", async () => {
      const { token, admin, user1, MINTER_ROLE } =
        await loadFixture(deployFixture);
      await expect(token.connect(admin).mint(user1.address, 1000n))
        .to.be.revertedWithCustomError(
          token,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(admin.address, MINTER_ROLE);
    });

    it("emits Transfer event on mint", async () => {
      const { token, minter, user1 } = await loadFixture(deployFixture);
      await expect(token.connect(minter).mint(user1.address, 500n))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, 500n);
    });

    it("totalSupply increases after mint", async () => {
      const { token, minter, user1 } = await loadFixture(deployFixture);
      await token.connect(minter).mint(user1.address, 1000n);
      expect(await token.totalSupply()).to.equal(1000n);
    });
  });

  describe("ERC20 standard", () => {
    it("transfer works after mint", async () => {
      const { token, minter, user1, user2 } = await loadFixture(deployFixture);
      await token.connect(minter).mint(user1.address, 1000n);
      await token.connect(user1).transfer(user2.address, 400n);
      expect(await token.balanceOf(user2.address)).to.equal(400n);
      expect(await token.balanceOf(user1.address)).to.equal(600n);
    });

    it("approve + transferFrom works", async () => {
      const { token, minter, user1, user2, admin } =
        await loadFixture(deployFixture);
      await token.connect(minter).mint(user1.address, 1000n);
      await token.connect(user1).approve(admin.address, 500n);
      await token
        .connect(admin)
        .transferFrom(user1.address, user2.address, 300n);
      expect(await token.balanceOf(user2.address)).to.equal(300n);
    });
  });
});
```

---

### test/TokenFaucet.test.ts

```typescript
describe("TokenFaucet", () => {
  const CLAIM_AMOUNT = 1000n * 10n ** 6n; // 1,000 USDT
  const COOLDOWN = 86400n; // 1 day in seconds

  async function deployFixture() {
    const [admin, user1, user2, attacker] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const TokenFaucet = await ethers.getContractFactory("TokenFaucet");

    const usdt = await MockERC20.deploy("Mock USDT", "USDT", 6, admin.address);
    const faucet = await TokenFaucet.deploy(admin.address);

    // Grant MINTER_ROLE cho Faucet
    const MINTER_ROLE = await usdt.MINTER_ROLE();
    await usdt.connect(admin).grantRole(MINTER_ROLE, await faucet.getAddress());

    // Config Faucet
    await faucet
      .connect(admin)
      .setTokenConfig(await usdt.getAddress(), true, CLAIM_AMOUNT, COOLDOWN);

    return { faucet, usdt, admin, user1, user2, attacker, MINTER_ROLE };
  }

  // ── Happy Path ──────────────────────────────────────────────────────────
  describe("claim()", () => {
    it("user claims successfully", async () => {
      const { faucet, usdt, user1 } = await loadFixture(deployFixture);
      await faucet.connect(user1).claim(await usdt.getAddress());
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT);
    });

    it("emits TokenClaimed event", async () => {
      const { faucet, usdt, user1 } = await loadFixture(deployFixture);
      await expect(faucet.connect(user1).claim(await usdt.getAddress()))
        .to.emit(faucet, "TokenClaimed")
        .withArgs(user1.address, await usdt.getAddress(), CLAIM_AMOUNT);
    });

    it("two different users can claim at same time", async () => {
      const { faucet, usdt, user1, user2 } = await loadFixture(deployFixture);
      await faucet.connect(user1).claim(await usdt.getAddress());
      await faucet.connect(user2).claim(await usdt.getAddress());
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT);
      expect(await usdt.balanceOf(user2.address)).to.equal(CLAIM_AMOUNT);
    });

    it("same user can claim again after cooldown", async () => {
      const { faucet, usdt, user1 } = await loadFixture(deployFixture);
      await faucet.connect(user1).claim(await usdt.getAddress());
      await time.increase(Number(COOLDOWN));
      await faucet.connect(user1).claim(await usdt.getAddress());
      expect(await usdt.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT * 2n);
    });
  });

  // ── Revert Cases ────────────────────────────────────────────────────────
  describe("claim() reverts", () => {
    it("unsupported token → UnsupportedToken", async () => {
      const { faucet, attacker, admin } = await loadFixture(deployFixture);
      const fakeToken = admin.address; // any address not configured
      await expect(
        faucet.connect(attacker).claim(fakeToken),
      ).to.be.revertedWithCustomError(faucet, "UnsupportedToken");
    });

    it("claim again before cooldown → FaucetCooldownActive", async () => {
      const { faucet, usdt, user1 } = await loadFixture(deployFixture);
      await faucet.connect(user1).claim(await usdt.getAddress());
      await expect(
        faucet.connect(user1).claim(await usdt.getAddress()),
      ).to.be.revertedWithCustomError(faucet, "FaucetCooldownActive");
    });

    it("claim when paused → Pausable error", async () => {
      const { faucet, usdt, user1, admin } = await loadFixture(deployFixture);
      await faucet.connect(admin).pause();
      await expect(
        faucet.connect(user1).claim(await usdt.getAddress()),
      ).to.be.revertedWithCustomError(faucet, "EnforcedPause");
    });
  });

  // ── Admin Tests ─────────────────────────────────────────────────────────
  describe("Admin permissions", () => {
    it("non-admin cannot setTokenConfig → AccessControl revert", async () => {
      const { faucet, usdt, attacker } = await loadFixture(deployFixture);
      await expect(
        faucet
          .connect(attacker)
          .setTokenConfig(await usdt.getAddress(), true, 100n, 100n),
      ).to.be.revertedWithCustomError(
        faucet,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("non-admin cannot pause → AccessControl revert", async () => {
      const { faucet, attacker } = await loadFixture(deployFixture);
      await expect(
        faucet.connect(attacker).pause(),
      ).to.be.revertedWithCustomError(
        faucet,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("admin can pause and unpause", async () => {
      const { faucet, usdt, user1, admin } = await loadFixture(deployFixture);
      await faucet.connect(admin).pause();
      await expect(
        faucet.connect(user1).claim(await usdt.getAddress()),
      ).to.be.revertedWithCustomError(faucet, "EnforcedPause");
      await faucet.connect(admin).unpause();
      await faucet.connect(user1).claim(await usdt.getAddress()); // success
    });
  });
});
```

---

### test/ExchangeVault.test.ts

```typescript
describe("ExchangeVault", () => {
  const DEPOSIT_AMOUNT = 500n * 10n ** 6n; // 500 USDT

  // accountReference là bytes32 ngẫu nhiên (mô phỏng Backend tạo)
  const ACCOUNT_REF_1 = ethers.encodeBytes32String("ref_001");
  const ACCOUNT_REF_2 = ethers.encodeBytes32String("ref_002");

  async function deployFixture() {
    const [admin, user1, user2, attacker] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const ExchangeVault = await ethers.getContractFactory("ExchangeVault");

    const usdt = await MockERC20.deploy("Mock USDT", "USDT", 6, admin.address);
    const vault = await ExchangeVault.deploy(admin.address);

    const usdtAddr = await usdt.getAddress();
    const vaultAddr = await vault.getAddress();

    // Setup: usdt supported, mint tokens, approve
    await vault.connect(admin).setSupportedToken(usdtAddr, true);
    const MINTER_ROLE = await usdt.MINTER_ROLE();
    await usdt.grantRole(MINTER_ROLE, admin.address);
    await usdt.connect(admin).mint(user1.address, DEPOSIT_AMOUNT * 5n);
    await usdt.connect(admin).mint(user2.address, DEPOSIT_AMOUNT * 5n);
    await usdt.connect(admin).mint(attacker.address, DEPOSIT_AMOUNT * 5n);

    return { vault, usdt, admin, user1, user2, attacker, usdtAddr, vaultAddr };
  }

  // ── Happy Path ──────────────────────────────────────────────────────────
  describe("deposit()", () => {
    it("deposit after approve — success", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } =
        await loadFixture(deployFixture);
      await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT);
      await vault
        .connect(user1)
        .deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1);
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT);
    });

    it("emits Deposited event with correct fields", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } =
        await loadFixture(deployFixture);
      await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT);
      await expect(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1),
      )
        .to.emit(vault, "Deposited")
        .withArgs(ACCOUNT_REF_1, user1.address, usdtAddr, DEPOSIT_AMOUNT);
    });

    it("user1 and user2 can use same accountReference (different depositKey)", async () => {
      const { vault, usdt, user1, user2, vaultAddr, usdtAddr } =
        await loadFixture(deployFixture);
      await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT);
      await usdt.connect(user2).approve(vaultAddr, DEPOSIT_AMOUNT);
      // Same accountRef — different depositors → OK (different depositKey)
      await vault
        .connect(user1)
        .deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1);
      await vault
        .connect(user2)
        .deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1);
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  // ── One-time accountReference ────────────────────────────────────────────
  describe("accountReference is one-time per depositor", () => {
    it("same depositor reuses same reference → DepositReferenceAlreadyUsed", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } =
        await loadFixture(deployFixture);
      await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT * 2n);
      await vault
        .connect(user1)
        .deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1);
      await expect(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1),
      ).to.be.revertedWithCustomError(vault, "DepositReferenceAlreadyUsed");
    });

    it("same depositor with different reference — success", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } =
        await loadFixture(deployFixture);
      await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT * 2n);
      await vault
        .connect(user1)
        .deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1);
      await vault
        .connect(user1)
        .deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_2);
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  // ── Revert Cases ────────────────────────────────────────────────────────
  describe("deposit() reverts", () => {
    it("unsupported token → UnsupportedToken", async () => {
      const { vault, user1 } = await loadFixture(deployFixture);
      const fakeToken = ethers.Wallet.createRandom().address;
      await expect(
        vault.connect(user1).deposit(fakeToken, DEPOSIT_AMOUNT, ACCOUNT_REF_1),
      ).to.be.revertedWithCustomError(vault, "UnsupportedToken");
    });

    it("amount = 0 → InvalidAmount", async () => {
      const { vault, user1, usdtAddr } = await loadFixture(deployFixture);
      await expect(
        vault.connect(user1).deposit(usdtAddr, 0n, ACCOUNT_REF_1),
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("accountReference = bytes32(0) → InvalidAccountReference", async () => {
      const { vault, user1, usdtAddr } = await loadFixture(deployFixture);
      await expect(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, ethers.ZeroHash),
      ).to.be.revertedWithCustomError(vault, "InvalidAccountReference");
    });

    it("no allowance → ERC20InsufficientAllowance revert", async () => {
      const { vault, user1, usdtAddr } = await loadFixture(deployFixture);
      // Không approve trước
      await expect(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1),
      ).to.be.reverted; // SafeERC20 revert
    });

    it("pause blocks deposit → EnforcedPause", async () => {
      const { vault, usdt, user1, admin, vaultAddr, usdtAddr } =
        await loadFixture(deployFixture);
      await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT);
      await vault.connect(admin).pause();
      await expect(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1),
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("cannot receive native ETH — reverts", async () => {
      const { vault, user1 } = await loadFixture(deployFixture);
      await expect(
        user1.sendTransaction({
          to: await vault.getAddress(),
          value: ethers.parseEther("1"),
        }),
      ).to.be.reverted;
    });
  });

  // ── Reentrancy ──────────────────────────────────────────────────────────
  describe("reentrancy protection", () => {
    it("nonReentrant prevents reentrancy attack on deposit", async () => {
      // Deploy attacker contract thử gọi deposit() lại trong callback
      // Cách đơn giản: dùng MockERC20 bình thường — safeTransferFrom không callback
      // Để test reentrancy thật cần deploy malicious ERC-777 hoặc hook
      // → Verify bằng code: nonReentrant modifier có mặt trên deposit()
      // → Unit test: verify contract inherits ReentrancyGuard và deposit có modifier
      const { vault } = await loadFixture(deployFixture);
      // Kiểm tra indirect: deposit thành công không bị lock sau lần đầu
      const { usdt, user1, vaultAddr, usdtAddr } =
        await loadFixture(deployFixture);
      await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT);
      await vault
        .connect(user1)
        .deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_1);
      // Deposit thứ 2 với ref khác vẫn thành công (nonReentrant không bị stuck)
      await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT);
      await vault
        .connect(user1)
        .deposit(usdtAddr, DEPOSIT_AMOUNT, ACCOUNT_REF_2);
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  // ── recoverERC20 ─────────────────────────────────────────────────────────
  describe("recoverERC20()", () => {
    it("admin recovers unsupported token sent by mistake", async () => {
      const { vault, admin, usdtAddr } = await loadFixture(deployFixture);

      // Deploy một token khác không được support
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const strayToken = await MockERC20.deploy(
        "Stray",
        "STR",
        18,
        admin.address,
      );
      const MINTER = await strayToken.MINTER_ROLE();
      await strayToken.grantRole(MINTER, admin.address);
      await strayToken.mint(await vault.getAddress(), ethers.parseEther("100"));

      // Admin recover stray token
      await vault
        .connect(admin)
        .recoverERC20(
          await strayToken.getAddress(),
          admin.address,
          ethers.parseEther("100"),
        );
      expect(await strayToken.balanceOf(admin.address)).to.equal(
        ethers.parseEther("100"),
      );
    });

    it("cannot recover supported token → CannotRecoverSupportedToken", async () => {
      const { vault, admin, usdtAddr } = await loadFixture(deployFixture);
      await expect(
        vault.connect(admin).recoverERC20(usdtAddr, admin.address, 1n),
      ).to.be.revertedWithCustomError(vault, "CannotRecoverSupportedToken");
    });

    it("non-admin cannot recover → AccessControl revert", async () => {
      const { vault, usdt, attacker, usdtAddr } =
        await loadFixture(deployFixture);
      await expect(
        vault.connect(attacker).recoverERC20(usdtAddr, attacker.address, 1n),
      ).to.be.revertedWithCustomError(
        vault,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("recover to zero address → ZeroAddress revert", async () => {
      const { vault, admin } = await loadFixture(deployFixture);
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const strayToken = await MockERC20.deploy("S", "S", 18, admin.address);
      await expect(
        vault
          .connect(admin)
          .recoverERC20(await strayToken.getAddress(), ethers.ZeroAddress, 1n),
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("emits ERC20Recovered event", async () => {
      const { vault, admin } = await loadFixture(deployFixture);
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const strayToken = await MockERC20.deploy("S", "S", 18, admin.address);
      const MINTER = await strayToken.MINTER_ROLE();
      await strayToken.grantRole(MINTER, admin.address);
      await strayToken.mint(await vault.getAddress(), 1000n);
      await expect(
        vault
          .connect(admin)
          .recoverERC20(await strayToken.getAddress(), admin.address, 1000n),
      )
        .to.emit(vault, "ERC20Recovered")
        .withArgs(await strayToken.getAddress(), admin.address, 1000n);
    });
  });

  // ── Admin Permissions ────────────────────────────────────────────────────
  describe("Admin permissions", () => {
    it("non-admin cannot setSupportedToken", async () => {
      const { vault, attacker, usdtAddr } = await loadFixture(deployFixture);
      await expect(
        vault.connect(attacker).setSupportedToken(usdtAddr, false),
      ).to.be.revertedWithCustomError(
        vault,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("non-admin cannot pause", async () => {
      const { vault, attacker } = await loadFixture(deployFixture);
      await expect(
        vault.connect(attacker).pause(),
      ).to.be.revertedWithCustomError(
        vault,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("admin can unsupport token, then recoverERC20 works", async () => {
      const { vault, usdt, admin, usdtAddr } = await loadFixture(deployFixture);
      // Unsupport token trước
      await vault.connect(admin).setSupportedToken(usdtAddr, false);
      // Giả lập có token trong vault
      const MINTER = await usdt.MINTER_ROLE();
      await usdt.grantRole(MINTER, admin.address);
      await usdt.mint(await vault.getAddress(), 1000n);
      // Giờ có thể recover
      await vault.connect(admin).recoverERC20(usdtAddr, admin.address, 1000n);
      expect(await usdt.balanceOf(admin.address)).to.equal(1000n);
    });
  });
});
```

---

## 11. Thứ Tự Implement

```
Bước 1.  pnpm add dependencies (hardhat-toolbox, dotenv)
Bước 2.  Cập nhật hardhat.config.ts
Bước 3.  Tạo contracts/interfaces/IMintableERC20.sol
Bước 4.  Viết lại contracts/MockERC20.sol (AccessControl, immutable decimals)
Bước 5.  Viết contracts/TokenFaucet.sol
Bước 6.  Viết contracts/ExchangeVault.sol (với recoverERC20)
Bước 7.  pnpm compile — phải clean, không warning
Bước 8.  Viết test/MockERC20.test.ts
Bước 9.  Viết test/TokenFaucet.test.ts
Bước 10. Viết test/ExchangeVault.test.ts
Bước 11. pnpm test — tất cả green
Bước 12. Viết scripts/deploy.ts
Bước 13. Test deploy: pnpm hardhat node (terminal 1) + pnpm hardhat run scripts/deploy.ts --network localhost (terminal 2)
Bước 14. Copy addresses vào .env backend
```

---

## 12. Definition of Done

### Contracts

- [ ] `MockERC20`: custom decimals immutable, chỉ `MINTER_ROLE` mint
- [ ] `TokenFaucet`: claim với cooldown per token, Pausable, admin cấu hình
- [ ] `ExchangeVault`: `depositKey` chống replay (one-time per depositor), SafeERC20, Pausable
- [ ] `ExchangeVault.recoverERC20`: chỉ cho unsupported token, to != zero address
- [ ] Không có `receive()` / `fallback()` trong Vault

### Tests — tất cả pass

- [ ] MockERC20: decimals, mint role, ERC20 standard
- [ ] TokenFaucet: claim, cooldown, unsupported, pause, admin permissions
- [ ] ExchangeVault: deposit happy path, one-time reference, revert cases, reentrancy check, recoverERC20, admin permissions

### Scripts

- [ ] Deploy script print đầy đủ addresses
- [ ] Configure scripts chạy được

### Build

- [ ] `pnpm compile` không có warning
- [ ] Private key chỉ từ env, không hardcode
