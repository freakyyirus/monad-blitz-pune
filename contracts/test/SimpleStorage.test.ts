import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function deployStorageFixture() {
  const [owner, other] = await ethers.getSigners();
  const SimpleStorage = await ethers.getContractFactory("SimpleStorage");
  const storage = await SimpleStorage.deploy(42);
  await storage.waitForDeployment();
  return { storage, owner, other };
}

describe("SimpleStorage", () => {
  it("initializes with the constructor value", async () => {
    const { storage } = await loadFixture(deployStorageFixture);
    expect(await storage.get()).to.equal(42n);
    expect(await storage.storedValue()).to.equal(42n);
  });

  it("sets a new value and records the updater", async () => {
    const { storage, other } = await loadFixture(deployStorageFixture);
    await storage.connect(other).set(12345n);
    expect(await storage.get()).to.equal(12345n);
    expect(await storage.lastUpdater()).to.equal(other.address);
  });

  it("emits ValueChanged", async () => {
    const { storage, other } = await loadFixture(deployStorageFixture);
    await expect(storage.connect(other).set(7n))
      .to.emit(storage, "ValueChanged")
      .withArgs(other.address, 7n);
  });
});