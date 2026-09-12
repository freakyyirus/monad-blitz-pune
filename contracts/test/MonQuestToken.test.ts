import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function deployTokenFixture() {
  const [owner, alice, bob] = await ethers.getSigners();
  const MonQuestToken = await ethers.getContractFactory("MonQuestToken");
  const token = await MonQuestToken.deploy("MonQuest", "MQ", 18, 1_000_000);
  await token.waitForDeployment();
  return { token, owner, alice, bob };
}

describe("MonQuestToken (ERC-20)", () => {
  it("deploys with correct metadata and initial supply", async () => {
    const { token, owner } = await loadFixture(deployTokenFixture);
    expect(await token.name()).to.equal("MonQuest");
    expect(await token.symbol()).to.equal("MQ");
    expect(await token.decimals()).to.equal(18n);
    expect(await token.totalSupply()).to.equal(1_000_000n * 10n ** 18n);
    expect(await token.balanceOf(owner.address)).to.equal(1_000_000n * 10n ** 18n);
  });

  it("transfers tokens and emits Transfer", async () => {
    const { token, owner, alice } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseUnits("100", 18);
    await expect(token.transfer(alice.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(owner.address, alice.address, amount);
    expect(await token.balanceOf(alice.address)).to.equal(amount);
    expect(await token.balanceOf(owner.address)).to.equal(1_000_000n * 10n ** 18n - amount);
  });

  it("reverts on transfer with insufficient balance", async () => {
    const { token, alice, bob } = await loadFixture(deployTokenFixture);
    await expect(
      token.connect(alice).transfer(bob.address, ethers.parseUnits("1", 18)),
    ).to.be.revertedWith("MonQuestToken: insufficient balance");
  });

  it("supports approve + transferFrom", async () => {
    const { token, owner, alice, bob } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseUnits("50", 18);
    await token.approve(alice.address, amount);
    expect(await token.allowance(owner.address, alice.address)).to.equal(amount);

    await token.connect(alice).transferFrom(owner.address, bob.address, amount);
    expect(await token.balanceOf(bob.address)).to.equal(amount);
    expect(await token.allowance(owner.address, alice.address)).to.equal(0n);
  });

  it("only owner can mint", async () => {
    const { token, owner, alice } = await loadFixture(deployTokenFixture);
    const supplyBefore = await token.totalSupply();
    await token.mint(alice.address, 10n * 10n ** 18n);
    expect(await token.balanceOf(alice.address)).to.equal(10n * 10n ** 18n);
    expect(await token.totalSupply()).to.equal(supplyBefore + 10n * 10n ** 18n);
    await expect(token.connect(alice).mint(alice.address, 1n))
      .to.be.revertedWith("MonQuestToken: caller is not the owner");
  });

  it("reverts transferring to zero address", async () => {
    const { token, owner } = await loadFixture(deployTokenFixture);
    await expect(token.transfer(ethers.ZeroAddress, 1n))
      .to.be.revertedWith("MonQuestToken: transfer to the zero address");
  });
});