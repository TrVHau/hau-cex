import { expect } from "chai";
import { ethers as ethersLib } from "ethers";
import { getSigners, getContractFactory } from "./helpers/hre.js";

// Hardhat 3: ethers được inject qua setup.ts root hook
// dùng getSigners() và getContractFactory() từ helpers/hre.ts

describe("MockERC20", () => {
  // ── Deploy helper ─────────────────────────────────────────────────────────
  async function deploy(name: string, symbol: string, decimals: number) {
    const [admin, minter, user1, user2] = await getSigners();
    const factory = await getContractFactory("MockERC20");
    const token = await factory.deploy(name, symbol, decimals, admin.address);
    await token.waitForDeployment();
    const MINTER_ROLE = await token.MINTER_ROLE();
    await (await token.connect(admin).grantRole(MINTER_ROLE, minter.address)).wait();
    return { token, admin, minter, user1, user2, MINTER_ROLE };
  }

  // ── Metadata ──────────────────────────────────────────────────────────────
  describe("Metadata", () => {
    it("returns correct name, symbol, decimals (USDT = 6)", async () => {
      const { token } = await deploy("Mock USDT", "USDT", 6);
      expect(await token.name()).to.equal("Mock USDT");
      expect(await token.symbol()).to.equal("USDT");
      expect(await token.decimals()).to.equal(6n);
    });

    it("supports 18 decimals (ETH-like)", async () => {
      const { token } = await deploy("Mock ETH", "ETH", 18);
      expect(await token.decimals()).to.equal(18n);
    });
  });

  // ── mint() ────────────────────────────────────────────────────────────────
  describe("mint()", () => {
    it("MINTER_ROLE can mint — balance increases", async () => {
      const { token, minter, user1 } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1000n)).wait();
      expect(await token.balanceOf(user1.address)).to.equal(1000n);
    });

    it("non-minter cannot mint → AccessControlUnauthorizedAccount", async () => {
      const { token, user1, user2, MINTER_ROLE } = await deploy("Mock USDT", "USDT", 6);
      await expect(token.connect(user1).mint(user2.address, 1000n))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, MINTER_ROLE);
    });

    it("admin (DEFAULT_ADMIN_ROLE only) cannot mint → revert", async () => {
      const [admin] = await getSigners();
      const factory = await getContractFactory("MockERC20");
      const token = await factory.deploy("Mock USDT", "USDT", 6, admin.address);
      await token.waitForDeployment();
      const MINTER_ROLE = await token.MINTER_ROLE();
      await expect(token.connect(admin).mint(admin.address, 1000n))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(admin.address, MINTER_ROLE);
    });

    it("emits Transfer(from=zero, to, amount) on mint", async () => {
      const { token, minter, user1 } = await deploy("Mock USDT", "USDT", 6);
      await expect(token.connect(minter).mint(user1.address, 500n))
        .to.emit(token, "Transfer")
        .withArgs(ethersLib.ZeroAddress, user1.address, 500n);
    });

    it("totalSupply increases after mint", async () => {
      const { token, minter, user1 } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1000n)).wait();
      expect(await token.totalSupply()).to.equal(1000n);
    });
  });

  // ── ERC20 Standard ────────────────────────────────────────────────────────
  describe("ERC20 standard", () => {
    it("transfer works after mint", async () => {
      const { token, minter, user1, user2 } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1000n)).wait();
      await (await token.connect(user1).transfer(user2.address, 400n)).wait();
      expect(await token.balanceOf(user1.address)).to.equal(600n);
      expect(await token.balanceOf(user2.address)).to.equal(400n);
    });

    it("approve + transferFrom works", async () => {
      const { token, minter, user1, user2, admin } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1000n)).wait();
      await (await token.connect(user1).approve(admin.address, 500n)).wait();
      await (await token.connect(admin).transferFrom(user1.address, user2.address, 300n)).wait();
      expect(await token.balanceOf(user2.address)).to.equal(300n);
    });

    it("transferFrom fails without approval → ERC20InsufficientAllowance", async () => {
      const { token, minter, user1, user2, admin } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1000n)).wait();
      await expect(token.connect(admin).transferFrom(user1.address, user2.address, 300n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });
});
