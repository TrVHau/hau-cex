import { expect } from "chai";
import { ethers as ethersLib } from "ethers";
import { getSigners, getFactory, assertReverts, assertEmitted } from "./helpers/contract.js";

const DEPOSIT_AMOUNT = 500n * 10n ** 6n; // 500 USDT (6 decimals)

// accountReference là bytes32 do Backend cung cấp — one-time per depositor
const REF_1   = ethersLib.encodeBytes32String("deposit-ref-001");
const REF_2   = ethersLib.encodeBytes32String("deposit-ref-002");
const ZERO_REF = ethersLib.ZeroHash; // bytes32(0) — invalid

describe("ExchangeVault", () => {
  // ─── Deploy helper ──────────────────────────────────────────────────────────
  async function deploy() {
    const [admin, user1, user2, attacker] = await getSigners();

    const USDT  = await getFactory("MockERC20");
    const Vault = await getFactory("ExchangeVault");

    const usdt  = await USDT.deploy("Mock USDT", "USDT", 6, admin.address);
    await usdt.waitForDeployment();

    const vault = await Vault.deploy(admin.address);
    await vault.waitForDeployment();

    const usdtAddr  = await usdt.getAddress();
    const vaultAddr = await vault.getAddress();

    // Support USDT
    await (await vault.connect(admin).setSupportedToken(usdtAddr, true)).wait();

    // Mint tokens cho các user
    const MINTER_ROLE = await usdt.MINTER_ROLE();
    await (await usdt.connect(admin).grantRole(MINTER_ROLE, admin.address)).wait();
    await (await usdt.connect(admin).mint(user1.address, DEPOSIT_AMOUNT * 10n)).wait();
    await (await usdt.connect(admin).mint(user2.address, DEPOSIT_AMOUNT * 10n)).wait();
    await (await usdt.connect(admin).mint(attacker.address, DEPOSIT_AMOUNT * 10n)).wait();

    return { vault, usdt, admin, user1, user2, attacker, usdtAddr, vaultAddr };
  }

  // ─── deposit() happy path ───────────────────────────────────────────────────
  describe("deposit() — happy path", () => {
    it("deposit sau approve — vault nhận đúng token", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT);
      expect(await usdt.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT * 9n);
    });

    it("emit Deposited(accountReference, depositor, token, amount)", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      const receipt = await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      assertEmitted(receipt, vault, "Deposited", [REF_1, user1.address, usdtAddr, DEPOSIT_AMOUNT]);
    });

    it("hai user khác dùng cùng REF → OK (depositKey khác nhau)", async () => {
      const { vault, usdt, user1, user2, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await (await usdt.connect(user2).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      await (await vault.connect(user2).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  // ─── accountReference one-time per depositor ────────────────────────────────
  describe("accountReference là one-time per depositor", () => {
    it("cùng user dùng lại REF → DepositReferenceAlreadyUsed", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT * 2n)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      await assertReverts(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1),
        "DepositReferenceAlreadyUsed",
      );
    });

    it("cùng user dùng REF khác → OK (cần tạo Deposit Intent mới)", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT * 2n)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_2)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  // ─── deposit() reverts ──────────────────────────────────────────────────────
  describe("deposit() — reverts", () => {
    it("token không supported → UnsupportedToken", async () => {
      const { vault, user1, admin } = await deploy();
      await assertReverts(
        vault.connect(user1).deposit(admin.address, DEPOSIT_AMOUNT, REF_1),
        "UnsupportedToken",
      );
    });

    it("amount = 0 → InvalidAmount", async () => {
      const { vault, user1, usdtAddr } = await deploy();
      await assertReverts(vault.connect(user1).deposit(usdtAddr, 0n, REF_1), "InvalidAmount");
    });

    it("accountReference = bytes32(0) → InvalidAccountReference", async () => {
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await assertReverts(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, ZERO_REF),
        "InvalidAccountReference",
      );
    });

    it("không approve ERC20 → revert (ERC20InsufficientAllowance)", async () => {
      const { vault, user1, usdtAddr } = await deploy();
      // Không gọi approve
      await assertReverts(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1),
        "ERC20InsufficientAllowance",
      );
    });

    it("vault đang paused → EnforcedPause", async () => {
      const { vault, usdt, user1, admin, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await (await vault.connect(admin).pause()).wait();
      await assertReverts(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1),
        "EnforcedPause",
      );
    });

    it("gửi native ETH vào vault → revert (không có receive())", async () => {
      const { vault, user1 } = await deploy();
      await assertReverts(
        user1.sendTransaction({ to: await vault.getAddress(), value: ethersLib.parseEther("1") }),
        "",
      );
    });
  });

  // ─── Reentrancy protection ──────────────────────────────────────────────────
  describe("Reentrancy protection", () => {
    it("nonReentrant: sequential deposits với REFs khác nhau đều thành công", async () => {
      // Standard ERC20 không có reentrancy callback → test verify contract không bị stuck
      const { vault, usdt, user1, vaultAddr, usdtAddr } = await deploy();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT * 2n)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_2)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  // ─── recoverERC20() ─────────────────────────────────────────────────────────
  describe("recoverERC20()", () => {
    async function deployWithStray() {
      const base = await deploy();
      const { admin, vault } = base;

      // Deploy stray token (KHÔNG supported trong vault)
      const STRAY      = await getFactory("MockERC20");
      const strayToken = await STRAY.deploy("Stray Token", "STR", 18, admin.address);
      await strayToken.waitForDeployment();
      const MINTER_ROLE = await strayToken.MINTER_ROLE();
      await (await strayToken.connect(admin).grantRole(MINTER_ROLE, admin.address)).wait();
      // Mint trực tiếp vào vault (giả lập token bị gửi nhầm)
      await (await strayToken.connect(admin).mint(await vault.getAddress(), ethersLib.parseEther("100"))).wait();

      return { ...base, strayToken };
    }

    it("admin recover stray token (unsupported) → thành công", async () => {
      const { vault, admin, strayToken } = await deployWithStray();
      const amount     = ethersLib.parseEther("100");
      const strayAddr  = await strayToken.getAddress();
      await (await vault.connect(admin).recoverERC20(strayAddr, admin.address, amount)).wait();
      expect(await strayToken.balanceOf(admin.address)).to.equal(amount);
      expect(await strayToken.balanceOf(await vault.getAddress())).to.equal(0n);
    });

    it("emit ERC20Recovered(token, to, amount)", async () => {
      const { vault, admin, strayToken } = await deployWithStray();
      const amount    = ethersLib.parseEther("100");
      const strayAddr = await strayToken.getAddress();
      const receipt   = await (await vault.connect(admin).recoverERC20(strayAddr, admin.address, amount)).wait();
      assertEmitted(receipt, vault, "ERC20Recovered", [strayAddr, admin.address, amount]);
    });

    it("recover supported token → CannotRecoverSupportedToken", async () => {
      const { vault, admin, usdtAddr } = await deploy();
      await assertReverts(
        vault.connect(admin).recoverERC20(usdtAddr, admin.address, 1n),
        "CannotRecoverSupportedToken",
      );
    });

    it("recover to address(0) → ZeroAddress", async () => {
      const { vault, admin, strayToken } = await deployWithStray();
      await assertReverts(
        vault.connect(admin).recoverERC20(await strayToken.getAddress(), ethersLib.ZeroAddress, 1n),
        "ZeroAddress",
      );
    });

    it("non-admin recover → AccessControlUnauthorizedAccount", async () => {
      const { vault, attacker, strayToken } = await deployWithStray();
      await assertReverts(
        vault.connect(attacker).recoverERC20(await strayToken.getAddress(), attacker.address, 1n),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("setSupportedToken(false) trước → recover thành công", async () => {
      const { vault, usdt, admin, usdtAddr } = await deploy();
      // Mint trực tiếp vào vault
      await (await usdt.connect(admin).mint(await vault.getAddress(), 1_000n)).wait();
      // Unsupport trước
      await (await vault.connect(admin).setSupportedToken(usdtAddr, false)).wait();
      // Giờ recover được
      await (await vault.connect(admin).recoverERC20(usdtAddr, admin.address, 1_000n)).wait();
      expect(await usdt.balanceOf(admin.address)).to.equal(1_000n);
    });
  });

  // ─── Admin permissions ──────────────────────────────────────────────────────
  describe("Admin permissions", () => {
    it("non-admin setSupportedToken → revert", async () => {
      const { vault, attacker, usdtAddr } = await deploy();
      await assertReverts(
        vault.connect(attacker).setSupportedToken(usdtAddr, false),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("non-admin pause → revert", async () => {
      const { vault, attacker } = await deploy();
      await assertReverts(vault.connect(attacker).pause(), "AccessControlUnauthorizedAccount");
    });

    it("admin pause → deposit revert, unpause → deposit OK", async () => {
      const { vault, usdt, user1, admin, vaultAddr, usdtAddr } = await deploy();
      await (await vault.connect(admin).pause()).wait();
      await (await usdt.connect(user1).approve(vaultAddr, DEPOSIT_AMOUNT)).wait();
      await assertReverts(
        vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1),
        "EnforcedPause",
      );
      await (await vault.connect(admin).unpause()).wait();
      await (await vault.connect(user1).deposit(usdtAddr, DEPOSIT_AMOUNT, REF_1)).wait();
      expect(await usdt.balanceOf(vaultAddr)).to.equal(DEPOSIT_AMOUNT);
    });

    it("setSupportedToken emits TokenSupportUpdated", async () => {
      const { vault, admin, usdtAddr } = await deploy();
      const receipt = await (await vault.connect(admin).setSupportedToken(usdtAddr, false)).wait();
      assertEmitted(receipt, vault, "TokenSupportUpdated", [usdtAddr, false]);
    });
  });
});
