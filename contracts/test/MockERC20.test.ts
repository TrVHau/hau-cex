import { expect } from "chai";
import { ethers as ethersLib } from "ethers";
import { getSigners, getFactory, assertReverts, assertEmitted } from "./helpers/contract.js";

describe("MockERC20", () => {
  // ─── Deploy helper ──────────────────────────────────────────────────────────
  async function deploy(name: string, symbol: string, decimals: number) {
    const [admin, minter, user1, user2] = await getSigners();
    const Factory = await getFactory("MockERC20");
    const token   = await Factory.deploy(name, symbol, decimals, admin.address);
    await token.waitForDeployment();
    const MINTER_ROLE = await token.MINTER_ROLE();
    await (await token.connect(admin).grantRole(MINTER_ROLE, minter.address)).wait();
    return { token, admin, minter, user1, user2, MINTER_ROLE };
  }

  // ─── Metadata ───────────────────────────────────────────────────────────────
  describe("Metadata", () => {
    it("name, symbol, decimals được set đúng (USDT=6)", async () => {
      const { token } = await deploy("Mock USDT", "USDT", 6);
      expect(await token.name()).to.equal("Mock USDT");
      expect(await token.symbol()).to.equal("USDT");
      expect(await token.decimals()).to.equal(6n);
    });

    it("hỗ trợ 18 decimals (WETH-like)", async () => {
      const { token } = await deploy("Mock WETH", "WETH", 18);
      expect(await token.decimals()).to.equal(18n);
    });
  });

  // ─── mint() ─────────────────────────────────────────────────────────────────
  describe("mint()", () => {
    it("MINTER_ROLE có thể mint — balance tăng đúng", async () => {
      const { token, minter, user1 } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1_000n)).wait();
      expect(await token.balanceOf(user1.address)).to.equal(1_000n);
    });

    it("non-minter mint → revert AccessControlUnauthorizedAccount", async () => {
      const { token, user1, user2 } = await deploy("Mock USDT", "USDT", 6);
      await assertReverts(
        token.connect(user1).mint(user2.address, 1_000n),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("admin (DEFAULT_ADMIN chỉ) không thể mint → revert", async () => {
      const [admin] = await getSigners();
      const Factory = await getFactory("MockERC20");
      const token   = await Factory.deploy("Mock USDT", "USDT", 6, admin.address);
      await token.waitForDeployment();
      await assertReverts(
        token.connect(admin).mint(admin.address, 1_000n),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("mint emits Transfer từ address(0)", async () => {
      const { token, minter, user1 } = await deploy("Mock USDT", "USDT", 6);
      const receipt = await (await token.connect(minter).mint(user1.address, 500n)).wait();
      assertEmitted(receipt, token, "Transfer", [ethersLib.ZeroAddress, user1.address, 500n]);
    });

    it("totalSupply tăng sau mint", async () => {
      const { token, minter, user1 } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1_000n)).wait();
      expect(await token.totalSupply()).to.equal(1_000n);
    });
  });

  // ─── ERC20 standard ─────────────────────────────────────────────────────────
  describe("ERC20 standard", () => {
    it("transfer hoạt động sau mint", async () => {
      const { token, minter, user1, user2 } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1_000n)).wait();
      await (await token.connect(user1).transfer(user2.address, 400n)).wait();
      expect(await token.balanceOf(user1.address)).to.equal(600n);
      expect(await token.balanceOf(user2.address)).to.equal(400n);
    });

    it("approve + transferFrom hoạt động đúng", async () => {
      const { token, minter, admin, user1, user2 } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1_000n)).wait();
      await (await token.connect(user1).approve(admin.address, 500n)).wait();
      await (await token.connect(admin).transferFrom(user1.address, user2.address, 300n)).wait();
      expect(await token.balanceOf(user2.address)).to.equal(300n);
    });

    it("transferFrom không approval → revert ERC20InsufficientAllowance", async () => {
      const { token, minter, admin, user1, user2 } = await deploy("Mock USDT", "USDT", 6);
      await (await token.connect(minter).mint(user1.address, 1_000n)).wait();
      await assertReverts(
        token.connect(admin).transferFrom(user1.address, user2.address, 300n),
        "ERC20InsufficientAllowance",
      );
    });
  });
});
