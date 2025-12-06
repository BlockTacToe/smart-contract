import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { BlOcXTacToe, ERC20Mock } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BlOcXTacToe - Payment Handling, Platform Fee & Counter Tests (T5)", function () {
  // Deploy contract fixture
  async function deployBlOcXTacToeFixture() {
    const signers = await ethers.getSigners();
    const [owner, admin, player1, player2, player3, randomUser, feeRecipient] = signers;

    const BlOcXTacToeFactory = await ethers.getContractFactory("BlOcXTacToe", owner);
    const blocXTacToe = await BlOcXTacToeFactory.deploy();

    await blocXTacToe.waitForDeployment();
    const contractAddress = await blocXTacToe.getAddress();

    // Deploy ERC20Mock for token payment tests
    const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock", owner);
    const erc20Mock = await ERC20MockFactory.deploy(
      "Test Token",
      "TEST",
      owner.address,
      ethers.parseEther("1000000") // 1M tokens
    );
    await erc20Mock.waitForDeployment();
    const erc20Address = await erc20Mock.getAddress();

    return { 
      blocXTacToe, 
      owner, 
      admin, 
      player1, 
      player2, 
      player3, 
      randomUser, 
      feeRecipient, 
      contractAddress,
      erc20Mock,
      erc20Address
    };
  }

  // ============ TEST 1: Payment Handling - ERC20 Token Transfers ============
  
  describe("Payment Handling - ERC20 Token Transfers", function () {
    async function setupTokenFixture() {
      const { blocXTacToe, owner, player1, player2, erc20Mock, erc20Address } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      
      // Set up ERC20 token support
      await blocXTacToe.connect(owner).addAdmin(owner.address);
      await blocXTacToe.connect(owner).setSupportedToken(erc20Address, true, "TEST");
      
      return { blocXTacToe, owner, player1, player2, erc20Mock, erc20Address };
    }

    it("Should require token approval for ERC20 payment", async function () {
      const { blocXTacToe, owner, player1, erc20Mock, erc20Address } = await loadFixture(setupTokenFixture);
      
      const betAmount = ethers.parseEther("0.01");
      await erc20Mock.connect(owner).mint(player1.address, betAmount * 2n);
      
      // Try to create game without approval - should fail
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, erc20Address, 3)
      ).to.be.reverted;
      
      // Approve and try again - should succeed
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount);
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, erc20Address, 3)
      ).to.emit(blocXTacToe, "GameCreated");
    });

    it("Should revert if insufficient token balance", async function () {
      const { blocXTacToe, player1, erc20Mock, erc20Address } = await loadFixture(setupTokenFixture);
      
      const betAmount = ethers.parseEther("0.01");
      
      // Don't mint any tokens to player1
      // Approve more than balance
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount);
      
      // Try to create game - should fail with insufficient balance
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, erc20Address, 3)
      ).to.be.reverted;
    });

    it("Should revert if insufficient token allowance", async function () {
      const { blocXTacToe, owner, player1, erc20Mock, erc20Address } = await loadFixture(setupTokenFixture);
      
      const betAmount = ethers.parseEther("0.01");
      await erc20Mock.connect(owner).mint(player1.address, betAmount * 2n);
      
      // Approve less than bet amount
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount / 2n);
      
      // Try to create game - should fail
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, erc20Address, 3)
      ).to.be.reverted;
    });

    it("Should check token allowance correctly", async function () {
      const { blocXTacToe, owner, player1, player2, erc20Mock, erc20Address } = await loadFixture(setupTokenFixture);
      
      const betAmount = ethers.parseEther("0.01");
      await erc20Mock.connect(owner).mint(player1.address, betAmount * 2n);
      await erc20Mock.connect(owner).mint(player2.address, betAmount * 2n);
      
      // Approve exact amount
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount);
      await erc20Mock.connect(player2).approve(await blocXTacToe.getAddress(), betAmount);
      
      // Create game - should succeed
      await blocXTacToe.connect(player1).createGame(betAmount, 0, erc20Address, 3);
      
      // Join game - should succeed
      await blocXTacToe.connect(player2).joinGame(0, 1);
      
      // Verify tokens were transferred
      const contractBalance = await erc20Mock.balanceOf(await blocXTacToe.getAddress());
      expect(contractBalance).to.equal(betAmount * 2n);
    });
  });

  // ============ TEST 2: Payment Handling - ETH Transfers ============
  
  describe("Payment Handling - ETH Transfers", function () {
    async function setupPlayersFixture() {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      
      return { blocXTacToe, player1, player2 };
    }

    it("Should check contract balance for ETH transfers", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.01");
      
      // Create game with ETH
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      
      // Check contract balance
      const contractBalance = await ethers.provider.getBalance(await blocXTacToe.getAddress());
      expect(contractBalance).to.equal(betAmount);
      
      // Join game with ETH
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Check contract balance again
      const contractBalanceAfter = await ethers.provider.getBalance(await blocXTacToe.getAddress());
      expect(contractBalanceAfter).to.equal(betAmount * 2n);
    });

    it("Should handle transfer failures correctly", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.01");
      
      // Create and join game
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Player1 wins
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 4);
      await blocXTacToe.connect(player1).play(0, 6);
      
      // Claim reward - should transfer ETH successfully
      const balanceBefore = await ethers.provider.getBalance(player1.address);
      const tx = await blocXTacToe.connect(player1).claimReward(0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(player1.address);
      
      // Should receive the reward (2 * betAmount, no fee by default)
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(betAmount * 2n);
    });
  });
});

