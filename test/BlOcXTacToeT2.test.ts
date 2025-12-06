import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { BlOcXTacToe } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BlOcXTacToe - Additional Test Coverage (T2)", function () {
  // Deploy contract fixture
  async function deployBlOcXTacToeFixture() {
    const signers = await ethers.getSigners();
    const [owner, admin, player1, player2, player3, randomUser, feeRecipient] = signers;

    const BlOcXTacToeFactory = await ethers.getContractFactory("BlOcXTacToe", owner);
    const blocXTacToe = await BlOcXTacToeFactory.deploy();

    await blocXTacToe.waitForDeployment();
    const contractAddress = await blocXTacToe.getAddress();

    return { 
      blocXTacToe, 
      owner, 
      admin, 
      player1, 
      player2, 
      player3, 
      randomUser, 
      feeRecipient, 
      contractAddress 
    };
  }

  // ============ TEST 1: Admin Functions - setKFactor() ============
  
  describe("Admin Functions - setKFactor()", function () {
    it("Should allow admin to set K factor", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      const newKFactor = 150; // 150 points per win/loss

      await expect(blocXTacToe.connect(admin).setKFactor(newKFactor))
        .to.emit(blocXTacToe, "KFactorUpdated")
        .withArgs(newKFactor);

      expect(await blocXTacToe.kFactor()).to.equal(newKFactor);
    });

    it("Should revert if K factor is 0", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      await expect(blocXTacToe.connect(admin).setKFactor(0))
        .to.be.revertedWithCustomError(blocXTacToe, "InvalidK");
    });

    it("Should revert if K factor > 1000", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      await expect(blocXTacToe.connect(admin).setKFactor(1001))
        .to.be.revertedWithCustomError(blocXTacToe, "InvalidK");
    });

    it("Should emit KFactorUpdated event", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      const newKFactor = 200;

      await expect(blocXTacToe.connect(admin).setKFactor(newKFactor))
        .to.emit(blocXTacToe, "KFactorUpdated")
        .withArgs(newKFactor);
    });

    it("Should verify K factor is updated correctly", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      
      // Check initial K factor (should be 100)
      expect(await blocXTacToe.kFactor()).to.equal(100);

      // Set new K factor
      const newKFactor = 250;
      await blocXTacToe.connect(admin).setKFactor(newKFactor);

      // Verify it was updated
      expect(await blocXTacToe.kFactor()).to.equal(newKFactor);
    });
  });

});

