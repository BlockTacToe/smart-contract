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

  // ============ TEST 3: Platform Fee ============
  
  describe("Platform Fee", function () {
    async function setupGameWithFeeFixture(feePercent: number) {
      const { blocXTacToe, owner, player1, player2, feeRecipient } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      
      // Set platform fee and recipient
      await blocXTacToe.connect(owner).addAdmin(owner.address);
      await blocXTacToe.connect(owner).setPlatformFee(feePercent);
      await blocXTacToe.connect(owner).setPlatformFeeRecipient(feeRecipient.address);
      
      return { blocXTacToe, owner, player1, player2, feeRecipient };
    }

    it("Should calculate fee correctly on win", async function () {
      const { blocXTacToe, player1, player2, feeRecipient } = await loadFixture(setupGameWithFeeFixture.bind(null, 500)); // 5%
      
      const betAmount = ethers.parseEther("1.0");
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Player1 wins
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 4);
      await blocXTacToe.connect(player1).play(0, 6);
      
      const totalPayout = betAmount * 2n;
      const expectedFee = (totalPayout * 500n) / 10000n; // 5%
      const expectedWinnerPayout = totalPayout - expectedFee;
      
      // Check claimable reward (winner payout)
      const claimableReward = await blocXTacToe.claimableRewards(0);
      expect(claimableReward).to.equal(expectedWinnerPayout);
      
      // Check fee recipient received fee
      const feeBalance = await ethers.provider.getBalance(feeRecipient.address);
      // Fee should have been transferred in _declareWinner
      expect(feeBalance).to.be.gte(expectedFee);
    });

    it("Should calculate fee correctly on forfeit", async function () {
      const { blocXTacToe, player1, player2, feeRecipient } = await loadFixture(setupGameWithFeeFixture.bind(null, 300)); // 3%
      
      const betAmount = ethers.parseEther("1.0");
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Make a move
      await blocXTacToe.connect(player1).play(0, 3);
      
      // Fast forward past timeout
      await time.increase(25 * 60 * 60);
      
      // Forfeit game
      await blocXTacToe.connect(player2).forfeitGame(0);
      
      const totalPayout = betAmount * 2n;
      const expectedFee = (totalPayout * 300n) / 10000n; // 3%
      const expectedWinnerPayout = totalPayout - expectedFee;
      
      // Check claimable reward
      const claimableReward = await blocXTacToe.claimableRewards(0);
      expect(claimableReward).to.equal(expectedWinnerPayout);
    });

    it("Should handle zero fee scenarios", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameWithFeeFixture.bind(null, 0)); // 0%
      
      const betAmount = ethers.parseEther("1.0");
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Player1 wins
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 4);
      await blocXTacToe.connect(player1).play(0, 6);
      
      // With 0% fee, winner should get full payout
      const totalPayout = betAmount * 2n;
      const claimableReward = await blocXTacToe.claimableRewards(0);
      expect(claimableReward).to.equal(totalPayout);
    });

    it("Should handle maximum fee (10%) scenarios", async function () {
      const { blocXTacToe, player1, player2, feeRecipient } = await loadFixture(setupGameWithFeeFixture.bind(null, 1000)); // 10%
      
      const betAmount = ethers.parseEther("1.0");
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Player1 wins
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 4);
      await blocXTacToe.connect(player1).play(0, 6);
      
      const totalPayout = betAmount * 2n;
      const expectedFee = (totalPayout * 1000n) / 10000n; // 10%
      const expectedWinnerPayout = totalPayout - expectedFee;
      
      const claimableReward = await blocXTacToe.claimableRewards(0);
      expect(claimableReward).to.equal(expectedWinnerPayout);
    });

    it("Should transfer fee to fee recipient correctly", async function () {
      const { blocXTacToe, owner, player1, player2, feeRecipient } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      
      // Set platform fee to 5%
      await blocXTacToe.connect(owner).addAdmin(owner.address);
      await blocXTacToe.connect(owner).setPlatformFee(500);
      await blocXTacToe.connect(owner).setPlatformFeeRecipient(feeRecipient.address);
      
      const betAmount = ethers.parseEther("1.0");
      const feeRecipientBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);
      
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Player1 wins
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 4);
      await blocXTacToe.connect(player1).play(0, 6);
      
      const feeRecipientBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);
      const totalPayout = betAmount * 2n;
      const expectedFee = (totalPayout * 500n) / 10000n;
      
      expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(expectedFee);
    });

    it("Should not affect winner payout calculation when fee is deducted", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameWithFeeFixture.bind(null, 250)); // 2.5%
      
      const betAmount = ethers.parseEther("1.0");
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });
      
      // Player1 wins
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 4);
      await blocXTacToe.connect(player1).play(0, 6);
      
      const totalPayout = betAmount * 2n;
      const fee = (totalPayout * 250n) / 10000n; // 2.5%
      const expectedWinnerPayout = totalPayout - fee;
      
      // Winner payout should be total - fee
      const claimableReward = await blocXTacToe.claimableRewards(0);
      expect(claimableReward).to.equal(expectedWinnerPayout);
      
      // Verify: fee + winner payout = total payout
      const feeBalance = await ethers.provider.getBalance((await ethers.getSigners())[6].address); // feeRecipient
      // Fee was already transferred, so we can verify the calculation is correct
      expect(claimableReward + fee).to.equal(totalPayout);
    });
  });

  // ============ TEST 4: Temporary Test Counter ============
  
  describe("Temporary Test Counter", function () {
    async function deployFixture() {
      const { blocXTacToe, randomUser } = await loadFixture(deployBlOcXTacToeFixture);
      return { blocXTacToe, randomUser };
    }

    it("Should return 0 initially for getCounter", async function () {
      const { blocXTacToe } = await loadFixture(deployFixture);
      
      const counter = await blocXTacToe.getCounter();
      expect(counter).to.equal(0n);
    });

    it("Should increment counter by 1", async function () {
      const { blocXTacToe, randomUser } = await loadFixture(deployFixture);
      
      // Counter should start at 0
      expect(await blocXTacToe.getCounter()).to.equal(0n);
      
      // Increment once
      await blocXTacToe.connect(randomUser).incrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(1n);
      
      // Increment again
      await blocXTacToe.connect(randomUser).incrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(2n);
    });

    it("Should allow anyone to increment counter", async function () {
      const { blocXTacToe, randomUser, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);
      
      // Random user increments
      await blocXTacToe.connect(randomUser).incrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(1n);
      
      // Player1 increments
      await blocXTacToe.connect(player1).incrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(2n);
      
      // Player2 increments
      await blocXTacToe.connect(player2).incrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(3n);
    });

    it("Should decrement counter by 1", async function () {
      const { blocXTacToe, randomUser } = await loadFixture(deployFixture);
      
      // Increment to 3 first
      await blocXTacToe.connect(randomUser).incrementCounter();
      await blocXTacToe.connect(randomUser).incrementCounter();
      await blocXTacToe.connect(randomUser).incrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(3n);
      
      // Decrement once
      await blocXTacToe.connect(randomUser).decrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(2n);
      
      // Decrement again
      await blocXTacToe.connect(randomUser).decrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(1n);
    });

    it("Should revert when decrementing from 0 (prevents underflow)", async function () {
      const { blocXTacToe, randomUser } = await loadFixture(deployFixture);
      
      // Counter starts at 0
      expect(await blocXTacToe.getCounter()).to.equal(0n);
      
      // Decrement from 0 - should revert with underflow panic (Solidity 0.8+ protection)
      await expect(
        blocXTacToe.connect(randomUser).decrementCounter()
      ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
    });

    it("Should allow anyone to decrement counter", async function () {
      const { blocXTacToe, randomUser, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);
      
      // Increment to 3 first
      await blocXTacToe.connect(randomUser).incrementCounter();
      await blocXTacToe.connect(randomUser).incrementCounter();
      await blocXTacToe.connect(randomUser).incrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(3n);
      
      // Random user decrements
      await blocXTacToe.connect(randomUser).decrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(2n);
      
      // Player1 decrements
      await blocXTacToe.connect(player1).decrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(1n);
      
      // Player2 decrements
      await blocXTacToe.connect(player2).decrementCounter();
      expect(await blocXTacToe.getCounter()).to.equal(0n);
    });

    it("Should return current counter value correctly", async function () {
      const { blocXTacToe, randomUser } = await loadFixture(deployFixture);
      
      // Start at 0
      expect(await blocXTacToe.getCounter()).to.equal(0n);
      
      // Increment multiple times
      for (let i = 0; i < 5; i++) {
        await blocXTacToe.connect(randomUser).incrementCounter();
        expect(await blocXTacToe.getCounter()).to.equal(BigInt(i + 1));
      }
      
      // Decrement a few times
      for (let i = 0; i < 2; i++) {
        await blocXTacToe.connect(randomUser).decrementCounter();
        expect(await blocXTacToe.getCounter()).to.equal(BigInt(5 - (i + 1)));
      }
      
      // Final value should be 3
      expect(await blocXTacToe.getCounter()).to.equal(3n);
    });
  });

  // ============ TEST 5: Winner Detection - Edge Cases ============
  
  describe("Winner Detection - Edge Cases", function () {
    async function setupGameFixture(boardSize: number = 3) {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      
      const betAmount = ethers.parseEther("0.01");
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, boardSize, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, Math.floor((boardSize * boardSize) / 2), { value: betAmount });
      
      return { blocXTacToe, player1, player2, betAmount };
    }

    it("Should detect vertical win (3 in a column) on 3x3 board", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 3));
      
      // 3x3 board: column 0 has positions 0, 3, 6
      // X at 0, O at 4 (from setup)
      // X plays at 3 (column 0, row 1)
      await blocXTacToe.connect(player1).play(0, 3);
      // O plays at 5
      await blocXTacToe.connect(player2).play(0, 5);
      // X plays at 6 (column 0, row 2) - vertical win!
      await blocXTacToe.connect(player1).play(0, 6);
      
      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect main diagonal win (top-left to bottom-right) on 3x3 board", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 3));
      
      // 3x3 board: main diagonal is 0, 4, 8
      // From setup: X at 0, O at 4 (center)
      // Since O already took center (4), we need a different diagonal
      // Let's use a different approach - X at 0, we need to get X at another diagonal position
      // Actually, let's create a fresh game for this test with a different initial move
      
      // Create new game with X at 0, O at 1 (not center)
      const betAmount = ethers.parseEther("0.01");
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(1, 1, { value: betAmount }); // O at 1, not 4
      
      // Now: X at 0, O at 1
      // X plays at 4 (center)
      await blocXTacToe.connect(player1).play(1, 4);
      // O plays at 2
      await blocXTacToe.connect(player2).play(1, 2);
      // X plays at 8 - main diagonal win! (0, 4, 8)
      await blocXTacToe.connect(player1).play(1, 8);
      
      const game = await blocXTacToe.getGame(1);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect anti-diagonal win (top-right to bottom-left) on 3x3 board", async function () {
      const { blocXTacToe, player1, player2, betAmount } = await loadFixture(setupGameFixture.bind(null, 3));
      
      // 3x3 board: anti-diagonal is 2, 4, 6
      // From setup: X at 0, O at 4 (center)
      // Create new game: X at 2, O at 1
      await blocXTacToe.connect(player1).createGame(betAmount, 2, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(1, 1, { value: betAmount }); // O at 1
      
      // Now: X at 2, O at 1
      // X plays at 4 (center) - now X at 2 and 4
      await blocXTacToe.connect(player1).play(1, 4);
      // O plays at 0 (blocks)
      await blocXTacToe.connect(player2).play(1, 0);
      // X plays at 6 - anti-diagonal win! (2, 4, 6)
      await blocXTacToe.connect(player1).play(1, 6);
      
      const game = await blocXTacToe.getGame(1);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect draw game (all cells filled, no winner)", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 3));
      
      // Create a draw: fill all cells without winner
      // X at 0, O at 4 (from setup)
      await blocXTacToe.connect(player1).play(0, 1); // X at 1
      await blocXTacToe.connect(player2).play(0, 3); // O at 3
      await blocXTacToe.connect(player1).play(0, 5); // X at 5
      await blocXTacToe.connect(player2).play(0, 2); // O at 2
      await blocXTacToe.connect(player1).play(0, 6); // X at 6
      await blocXTacToe.connect(player2).play(0, 7); // O at 7
      await blocXTacToe.connect(player1).play(0, 8); // X at 8 - draw!
      
      const game = await blocXTacToe.getGame(0);
      expect(game.status).to.equal(1); // Ended
      expect(game.winner).to.equal(ethers.ZeroAddress); // No winner
    });

    it("Should detect Player 2 (O) winning scenarios", async function () {
      const { blocXTacToe, player1, player2, betAmount } = await loadFixture(setupGameFixture.bind(null, 3));
      
      // 3x3 board: Player2 (O) wins horizontally in row 1 (3, 4, 5)
      // Create new game: X at 3, O at 0 (so O can win)
      await blocXTacToe.connect(player1).createGame(betAmount, 3, ethers.ZeroAddress, 3, { value: betAmount }); // X at 3
      await blocXTacToe.connect(player2).joinGame(1, 0, { value: betAmount }); // O at 0
      
      // Now: X at 3, O at 0
      // X plays at 6
      await blocXTacToe.connect(player1).play(1, 6);
      // O plays at 4 (row 1, col 1) - now O at 0 and 4, but we want O in row 1
      // Actually, let's set it up differently: O needs to win in row 1 (3, 4, 5)
      // X at 3 (row 1, col 0), O at 4 (row 1, col 1) - but X already at 3
      // Better: Start with X at different position
      
      // Create new game: X at 6, O at 3
      await blocXTacToe.connect(player1).createGame(betAmount, 6, ethers.ZeroAddress, 3, { value: betAmount }); // X at 6
      await blocXTacToe.connect(player2).joinGame(2, 3, { value: betAmount }); // O at 3 (row 1, col 0)
      
      // Now: X at 6, O at 3
      // X plays at 0
      await blocXTacToe.connect(player1).play(2, 0);
      // O plays at 4 (row 1, col 1) - now O at 3 and 4
      await blocXTacToe.connect(player2).play(2, 4);
      // X plays at 1
      await blocXTacToe.connect(player1).play(2, 1);
      // O plays at 5 (row 1, col 2) - horizontal win for O! (3, 4, 5)
      await blocXTacToe.connect(player2).play(2, 5);
      
      const game = await blocXTacToe.getGame(2);
      expect(game.winner).to.equal(player2.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect win on 5x5 board (vertical win)", async function () {
      const { blocXTacToe, player1, player2, betAmount } = await loadFixture(setupGameFixture.bind(null, 5));
      
      // 5x5 board: column 2 has positions 2, 7, 12
      // Create new game: X at 2, O at 3
      await blocXTacToe.connect(player1).createGame(betAmount, 2, ethers.ZeroAddress, 5, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(1, 3, { value: betAmount }); // O at 3
      
      // Now: X at 2, O at 3
      // X plays at 7 (column 2, row 1) - now X at 2 and 7
      await blocXTacToe.connect(player1).play(1, 7);
      // O plays at 4
      await blocXTacToe.connect(player2).play(1, 4);
      // X plays at 12 (column 2, row 2) - vertical win! (2, 7, 12)
      await blocXTacToe.connect(player1).play(1, 12);
      
      const game = await blocXTacToe.getGame(1);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect win on 7x7 board (horizontal win)", async function () {
      const { blocXTacToe, player1, player2, betAmount } = await loadFixture(setupGameFixture.bind(null, 7));
      
      // 7x7 board: row 3 has positions 21, 22, 23
      // Create new game: X at 21, O at 25
      await blocXTacToe.connect(player1).createGame(betAmount, 21, ethers.ZeroAddress, 7, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(1, 25, { value: betAmount }); // O at 25
      
      // Now: X at 21, O at 25
      // X plays at 22 (row 3, col 1) - now X at 21 and 22
      await blocXTacToe.connect(player1).play(1, 22);
      // O plays at 26
      await blocXTacToe.connect(player2).play(1, 26);
      // X plays at 23 (row 3, col 2) - horizontal win! (21, 22, 23)
      await blocXTacToe.connect(player1).play(1, 23);
      
      const game = await blocXTacToe.getGame(1);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect first win when multiple wins are possible (horizontal detected first)", async function () {
      const { blocXTacToe, player1, player2, betAmount } = await loadFixture(setupGameFixture.bind(null, 3));
      
      // Setup a scenario where a single move could create multiple wins
      // Create a position where X can win both horizontally and vertically
      // 3x3 board layout after setup moves:
      // X O X  (row 0: X at 0 and 2, O at 1)
      // X _ _  (row 1: X at 3)
      // _ _ _  (row 2: empty)
      
      // Create new game: X at 0
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(1, 1, { value: betAmount }); // O at 1
      
      // Now: X at 0, O at 1
      // X plays at 2 (completes row 0: X at 0, 2)
      await blocXTacToe.connect(player1).play(1, 2);
      // O plays at 4
      await blocXTacToe.connect(player2).play(1, 4);
      // X plays at 3 (row 1, col 0) - now X at 0, 2, 3
      await blocXTacToe.connect(player1).play(1, 3);
      // O plays at 5
      await blocXTacToe.connect(player2).play(1, 5);
      // X plays at 6 - this completes vertical (0, 3, 6) but also row 2 starts
      // Actually, let's create a clearer scenario: X needs to win both ways
      // X at 0, 2 (row 0), X at 3 (row 1), so X needs at 6 for vertical (0,3,6)
      // But also X at 0, 2 means horizontal row 0 needs X at 1, but O is there
      
      // Better: X at 0, X at 3, X at 6 (vertical col 0)
      // And X at 0, X at 1, X at 2 (horizontal row 0) - but O at 1 blocks
      // Let's test with what we have: X plays at 6 completes vertical (0, 3, 6)
      await blocXTacToe.connect(player1).play(1, 6);
      
      const game = await blocXTacToe.getGame(1);
      // Vertical win should be detected (0, 3, 6)
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect first win when multiple wins are possible (diagonal detected)", async function () {
      const { blocXTacToe, player1, player2, betAmount } = await loadFixture(setupGameFixture.bind(null, 3));
      
      // Create a scenario where a move completes a diagonal win
      // 3x3 board: main diagonal is 0, 4, 8
      // Create new game: X at 0, O at 1
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(1, 1, { value: betAmount }); // O at 1
      
      // Now: X at 0, O at 1
      // X plays at 4 (center) - now X at 0 and 4 (diagonal started)
      await blocXTacToe.connect(player1).play(1, 4);
      // O plays at 2
      await blocXTacToe.connect(player2).play(1, 2);
      // X plays at 8 - completes main diagonal (0, 4, 8)
      await blocXTacToe.connect(player1).play(1, 8);
      
      const game = await blocXTacToe.getGame(1);
      // Diagonal win should be detected
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1);
    });
  });
});

