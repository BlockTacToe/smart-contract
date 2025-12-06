import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { BlOcXTacToe, ERC20Mock } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BlOcXTacToe - Claim Reward & Challenge System Tests (T3)", function () {
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

  // ============ TEST 1: Claim Reward - Edge Cases ============
  
  describe("Claim Reward - Edge Cases", function () {
    // Setup game with platform fee for testing
    async function setupGameWithFeeFixture() {
      const { blocXTacToe, owner, player1, player2, feeRecipient } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      
      // Set platform fee to 5% (500 basis points)
      await blocXTacToe.connect(owner).addAdmin(owner.address);
      await blocXTacToe.connect(owner).setPlatformFee(500);
      await blocXTacToe.connect(owner).setPlatformFeeRecipient(feeRecipient.address);
      
      const betAmount = ethers.parseEther("1.0");
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Player1 wins (0, 3, 6)
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 4);
      await blocXTacToe.connect(player1).play(0, 6);
      
      return { blocXTacToe, owner, player1, player2, feeRecipient, betAmount };
    }

    it("Should deduct platform fee on reward claim", async function () {
      const { blocXTacToe, player1, betAmount } = await loadFixture(setupGameWithFeeFixture);
      
      // Total payout is 2 * betAmount = 2.0 ETH
      // Fee is 5% = 0.1 ETH
      // Winner payout is 1.9 ETH
      const totalPayout = betAmount * 2n;
      const expectedFee = (totalPayout * 500n) / 10000n;
      const expectedWinnerPayout = totalPayout - expectedFee;
      
      const balanceBefore = await ethers.provider.getBalance(player1.address);
      const tx = await blocXTacToe.connect(player1).claimReward(0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(player1.address);
      
      const claimableReward = await blocXTacToe.claimableRewards(0);
      expect(claimableReward).to.equal(0); // Should be cleared after claim
      
      // Balance increase should be winner payout minus gas
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(expectedWinnerPayout);
    });

    it("Should transfer platform fee to fee recipient", async function () {
      const { blocXTacToe, owner, player1, player2, feeRecipient } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      
      // Set platform fee to 5% (500 basis points)
      await blocXTacToe.connect(owner).addAdmin(owner.address);
      await blocXTacToe.connect(owner).setPlatformFee(500);
      await blocXTacToe.connect(owner).setPlatformFeeRecipient(feeRecipient.address);
      
      const betAmount = ethers.parseEther("1.0");
      const balanceBefore = await ethers.provider.getBalance(feeRecipient.address);
      
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Player1 wins (0, 3, 6) - this triggers _declareWinner which transfers fee
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 4);
      await blocXTacToe.connect(player1).play(0, 6);
      
      const balanceAfter = await ethers.provider.getBalance(feeRecipient.address);
      const totalPayout = betAmount * 2n;
      const expectedFee = (totalPayout * 500n) / 10000n;
      
      // Fee should have been transferred when game ended (in _declareWinner)
      expect(balanceAfter - balanceBefore).to.equal(expectedFee);
    });

    it("Should claim ERC20 token reward correctly", async function () {
      const { blocXTacToe, owner, player1, player2, erc20Mock, erc20Address } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      
      // Set up ERC20 token support
      await blocXTacToe.connect(owner).addAdmin(owner.address);
      await blocXTacToe.connect(owner).setSupportedToken(erc20Address, true, "TEST");
      
      const betAmount = ethers.parseEther("1.0");
      await erc20Mock.connect(owner).mint(player1.address, betAmount * 2n);
      await erc20Mock.connect(owner).mint(player2.address, betAmount * 2n);
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount);
      await erc20Mock.connect(player2).approve(await blocXTacToe.getAddress(), betAmount);
      
      await blocXTacToe.connect(player1).createGame(betAmount, 0, erc20Address, 3);
      await blocXTacToe.connect(player2).joinGame(0, 1);
      
      // Player1 wins
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 4);
      await blocXTacToe.connect(player1).play(0, 6);
      
      const balanceBefore = await erc20Mock.balanceOf(player1.address);
      await blocXTacToe.connect(player1).claimReward(0);
      const balanceAfter = await erc20Mock.balanceOf(player1.address);
      
      // Should receive 2 * betAmount (no fee in this case, default is 0%)
      expect(balanceAfter - balanceBefore).to.equal(betAmount * 2n);
    });

    it("Should claim reward after forfeit", async function () {
      const { blocXTacToe, player1, player2, betAmount } = await loadFixture(setupGameWithFeeFixture);
      
      // Create a new game that will be forfeited
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(1, 1, { value: betAmount });
      
      // Make a move to set lastMoveTimestamp
      await blocXTacToe.connect(player1).play(1, 3);
      
      // Fast forward past timeout
      await time.increase(25 * 60 * 60); // 25 hours
      
      // Player2 forfeits (player1 wins since it's player2's turn)
      await blocXTacToe.connect(player2).forfeitGame(1);
      
      const game = await blocXTacToe.games(1);
      expect(game.status).to.equal(2); // Forfeited = 2 (Active=0, Ended=1, Forfeited=2)
      expect(game.winner).to.equal(player1.address);
      
      // Player1 should be able to claim reward
      const balanceBefore = await ethers.provider.getBalance(player1.address);
      const tx = await blocXTacToe.connect(player1).claimReward(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(player1.address);
      
      const expectedPayout = betAmount * 2n - ((betAmount * 2n * 500n) / 10000n);
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(expectedPayout);
    });
  });

  // ============ TEST 2: Challenge System - createChallenge() ============
  
  describe("Challenge System - createChallenge() Edge Cases", function () {
    async function setupPlayersFixture() {
      const { blocXTacToe, owner, player1, player2, player3, erc20Mock, erc20Address } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      await blocXTacToe.connect(player3).registerPlayer("player3");
      
      // Set up ERC20 token support
      await blocXTacToe.connect(owner).addAdmin(owner.address);
      await blocXTacToe.connect(owner).setSupportedToken(erc20Address, true, "TEST");
      
      return { blocXTacToe, owner, player1, player2, player3, erc20Mock, erc20Address };
    }

    it("Should create challenge with ERC20 token", async function () {
      const { blocXTacToe, owner, player1, player2, erc20Mock, erc20Address } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.1");
      await erc20Mock.connect(owner).mint(player1.address, betAmount * 2n);
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount);
      
      await expect(
        blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, erc20Address, 3)
      )
        .to.emit(blocXTacToe, "ChallengeCreated")
        .withArgs(0, player1.address, player2.address, betAmount);
      
      const challenge = await blocXTacToe.getChallenge(0);
      expect(challenge.challenger).to.equal(player1.address);
      expect(challenge.challenged).to.equal(player2.address);
      expect(challenge.betAmount).to.equal(betAmount);
      expect(challenge.tokenAddress).to.equal(erc20Address);
      expect(challenge.boardSize).to.equal(3);
    });

    it("Should create challenge with 5x5 board size", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.1");
      await expect(
        blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, 5, { value: betAmount })
      )
        .to.emit(blocXTacToe, "ChallengeCreated");
      
      const challenge = await blocXTacToe.getChallenge(0);
      expect(challenge.boardSize).to.equal(5);
    });

    it("Should create challenge with 7x7 board size", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.1");
      await expect(
        blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, 7, { value: betAmount })
      )
        .to.emit(blocXTacToe, "ChallengeCreated");
      
      const challenge = await blocXTacToe.getChallenge(0);
      expect(challenge.boardSize).to.equal(7);
    });

    it("Should revert if board size is invalid", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.1");
      await expect(
        blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, 4, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidSize");
    });

    it("Should revert if challenged player is not registered", async function () {
      const { blocXTacToe, player1 } = await loadFixture(setupPlayersFixture);
      
      // Use a different address that's not registered
      const unregisteredAddress = (await ethers.getSigners())[10].address;
      
      const betAmount = ethers.parseEther("0.1");
      await expect(
        blocXTacToe.connect(player1).createChallenge(unregisteredAddress, betAmount, ethers.ZeroAddress, 3, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "NotReg");
    });

    it("Should revert if challenged address is zero", async function () {
      const { blocXTacToe, player1 } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.1");
      await expect(
        blocXTacToe.connect(player1).createChallenge(ethers.ZeroAddress, betAmount, ethers.ZeroAddress, 3, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidAddr");
    });

    it("Should revert if token is not supported", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);
      
      // Use an unsupported token address
      const unsupportedToken = (await ethers.getSigners())[10].address;
      
      const betAmount = ethers.parseEther("0.1");
      await expect(
        blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, unsupportedToken, 3, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "TokenNotSup");
    });
  });

  // ============ TEST 3: Challenge System - acceptChallenge() ============
  
  describe("Challenge System - acceptChallenge() Edge Cases", function () {
    async function setupChallengeFixture() {
      const { blocXTacToe, owner, player1, player2, erc20Mock, erc20Address } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      
      // Set up ERC20 token support
      await blocXTacToe.connect(owner).addAdmin(owner.address);
      await blocXTacToe.connect(owner).setSupportedToken(erc20Address, true, "TEST");
      
      return { blocXTacToe, owner, player1, player2, erc20Mock, erc20Address };
    }

    it("Should accept challenge with ERC20 token payment", async function () {
      const { blocXTacToe, owner, player1, player2, erc20Mock, erc20Address } = await loadFixture(setupChallengeFixture);
      
      const betAmount = ethers.parseEther("0.1");
      await erc20Mock.connect(owner).mint(player1.address, betAmount * 2n);
      await erc20Mock.connect(owner).mint(player2.address, betAmount * 2n);
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount);
      await erc20Mock.connect(player2).approve(await blocXTacToe.getAddress(), betAmount);
      
      // Create challenge with ERC20
      await blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, erc20Address, 3);
      
      // Accept challenge
      await expect(
        blocXTacToe.connect(player2).acceptChallenge(0, 5)
      )
        .to.emit(blocXTacToe, "ChallengeAccepted")
        .withArgs(0, 0); // challengeId, gameId
      
      const challenge = await blocXTacToe.getChallenge(0);
      expect(challenge.accepted).to.be.true;
      expect(challenge.gameId).to.equal(0);
      
      const game = await blocXTacToe.games(0);
      expect(game.playerOne).to.equal(player1.address);
      expect(game.playerTwo).to.equal(player2.address);
      expect(game.tokenAddress).to.equal(erc20Address);
    });

    it("Should revert if move index is invalid", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupChallengeFixture);
      
      const betAmount = ethers.parseEther("0.1");
      await blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, 3, { value: betAmount });
      
      // Invalid move index for 3x3 board (9 cells, valid indices 0-8)
      await expect(
        blocXTacToe.connect(player2).acceptChallenge(0, 9, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidMove");
    });

    it("Should create game from challenge correctly", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupChallengeFixture);
      
      const betAmount = ethers.parseEther("0.1");
      await blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, 5, { value: betAmount });
      
      await blocXTacToe.connect(player2).acceptChallenge(0, 12, { value: betAmount });
      
      const challenge = await blocXTacToe.getChallenge(0);
      expect(challenge.gameId).to.equal(0);
      expect(challenge.accepted).to.be.true;
      
      const game = await blocXTacToe.games(0);
      expect(game.playerOne).to.equal(player1.address);
      expect(game.playerTwo).to.equal(player2.address);
      expect(game.betAmount).to.equal(betAmount);
      expect(game.boardSize).to.equal(5);
      expect(game.tokenAddress).to.equal(ethers.ZeroAddress);
      expect(game.status).to.equal(0); // Active
      expect(await blocXTacToe.gameBoards(0, 12)).to.equal(1); // Challenger's first move
    });
  });

  // ============ TEST 4: Challenge System - getPlayerChallenges() ============
  
  describe("Challenge System - getPlayerChallenges()", function () {
    async function setupPlayersFixture() {
      const { blocXTacToe, owner, player1, player2, player3 } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      await blocXTacToe.connect(player3).registerPlayer("player3");
      
      return { blocXTacToe, player1, player2, player3 };
    }

    it("Should return all challenges for a player (sent and received)", async function () {
      const { blocXTacToe, player1, player2, player3 } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.1");
      
      // Player1 challenges player2 (challenge 0)
      await blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, 3, { value: betAmount });
      
      // Player3 challenges player1 (challenge 1)
      await blocXTacToe.connect(player3).createChallenge(player1.address, betAmount, ethers.ZeroAddress, 3, { value: betAmount });
      
      // Player1 challenges player3 (challenge 2)
      await blocXTacToe.connect(player1).createChallenge(player3.address, betAmount, ethers.ZeroAddress, 3, { value: betAmount });
      
      // Player1 should have challenges: 0 (sent), 1 (received), 2 (sent)
      const player1Challenges = await blocXTacToe.getPlayerChallenges(player1.address);
      expect(player1Challenges.length).to.equal(3);
      expect(player1Challenges).to.include(0n);
      expect(player1Challenges).to.include(1n);
      expect(player1Challenges).to.include(2n);
    });

    it("Should return empty array if player has no challenges", async function () {
      const { blocXTacToe, player1, player2, player3 } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.1");
      
      // Player1 challenges player2
      await blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, 3, { value: betAmount });
      
      // Player3 should have no challenges
      const player3Challenges = await blocXTacToe.getPlayerChallenges(player3.address);
      expect(player3Challenges.length).to.equal(0);
    });

    it("Should include both sent and received challenges", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);
      
      const betAmount = ethers.parseEther("0.1");
      
      // Player1 sends challenge to player2
      await blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, 3, { value: betAmount });
      
      // Player2 sends challenge to player1
      await blocXTacToe.connect(player2).createChallenge(player1.address, betAmount, ethers.ZeroAddress, 3, { value: betAmount });
      
      // Player1 should have both: challenge 0 (sent) and challenge 1 (received)
      const player1Challenges = await blocXTacToe.getPlayerChallenges(player1.address);
      expect(player1Challenges.length).to.equal(2);
      expect(player1Challenges).to.include(0n);
      expect(player1Challenges).to.include(1n);
      
      // Player2 should have both: challenge 0 (received) and challenge 1 (sent)
      const player2Challenges = await blocXTacToe.getPlayerChallenges(player2.address);
      expect(player2Challenges.length).to.equal(2);
      expect(player2Challenges).to.include(0n);
      expect(player2Challenges).to.include(1n);
    });
  });
});

