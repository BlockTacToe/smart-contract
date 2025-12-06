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

  // ============ TEST 2: Admin Functions - setSupportedToken() ============

  describe("Admin Functions - setSupportedToken()", function () {
    it("Should allow admin to add new token", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      
      // Create a mock token address
      const mockToken = ethers.Wallet.createRandom().address;
      const tokenName = "USDC";

      await expect(blocXTacToe.connect(admin).setSupportedToken(mockToken, true, tokenName))
        .to.emit(blocXTacToe, "TokenSupported")
        .withArgs(mockToken, true);

      expect(await blocXTacToe.supportedTokens(mockToken)).to.be.true;
      expect(await blocXTacToe.isTokenSupported(mockToken)).to.be.true;
    });

    it("Should store token name when adding", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      
      const mockToken = ethers.Wallet.createRandom().address;
      const tokenName = "DAI";

      await blocXTacToe.connect(admin).setSupportedToken(mockToken, true, tokenName);

      expect(await blocXTacToe.getTokenName(mockToken)).to.equal(tokenName);
    });

    it("Should emit TokenSupported event", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      
      const mockToken = ethers.Wallet.createRandom().address;
      const tokenName = "WETH";

      await expect(blocXTacToe.connect(admin).setSupportedToken(mockToken, true, tokenName))
        .to.emit(blocXTacToe, "TokenSupported")
        .withArgs(mockToken, true);
    });

    it("Should update supportedTokensList correctly when adding", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      
      const mockToken = ethers.Wallet.createRandom().address;
      const tokenName = "LINK";

      const tokensBefore = await blocXTacToe.getSupportedTokens();
      
      await blocXTacToe.connect(admin).setSupportedToken(mockToken, true, tokenName);

      const tokensAfter = await blocXTacToe.getSupportedTokens();
      expect(tokensAfter.length).to.equal(tokensBefore.length + 1);
      expect(tokensAfter).to.include(mockToken);
    });

    it("Should allow admin to remove token", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      
      const mockToken = ethers.Wallet.createRandom().address;
      const tokenName = "USDT";

      // First add the token
      await blocXTacToe.connect(admin).setSupportedToken(mockToken, true, tokenName);
      expect(await blocXTacToe.supportedTokens(mockToken)).to.be.true;

      // Then remove it
      await expect(blocXTacToe.connect(admin).setSupportedToken(mockToken, false, ""))
        .to.emit(blocXTacToe, "TokenSupported")
        .withArgs(mockToken, false);

      expect(await blocXTacToe.supportedTokens(mockToken)).to.be.false;
      expect(await blocXTacToe.isTokenSupported(mockToken)).to.be.false;
    });

    it("Should handle duplicate token additions", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      
      const mockToken = ethers.Wallet.createRandom().address;
      const tokenName = "MATIC";

      // Add token first time
      await blocXTacToe.connect(admin).setSupportedToken(mockToken, true, tokenName);
      const tokensAfterFirst = await blocXTacToe.getSupportedTokens();

      // Try to add same token again (should not duplicate in list)
      await blocXTacToe.connect(admin).setSupportedToken(mockToken, true, tokenName);
      const tokensAfterSecond = await blocXTacToe.getSupportedTokens();

      // Should have same length (no duplicate added)
      expect(tokensAfterSecond.length).to.equal(tokensAfterFirst.length);
      expect(await blocXTacToe.supportedTokens(mockToken)).to.be.true;
    });

    it("Should revert if non-admin tries to set token", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);
      
      const mockToken = ethers.Wallet.createRandom().address;

      await expect(
        blocXTacToe.connect(player1).setSupportedToken(mockToken, true, "TOKEN")
      ).to.be.revertedWithCustomError(blocXTacToe, "NotAdmin");
    });

    it("Should remove token from supportedTokensList when disabled", async function () {
      const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(owner).addAdmin(admin.address);
      
      const mockToken = ethers.Wallet.createRandom().address;
      const tokenName = "AAVE";

      // Add token
      await blocXTacToe.connect(admin).setSupportedToken(mockToken, true, tokenName);
      const tokensAfterAdd = await blocXTacToe.getSupportedTokens();
      expect(tokensAfterAdd).to.include(mockToken);

      // Remove token
      await blocXTacToe.connect(admin).setSupportedToken(mockToken, false, "");
      const tokensAfterRemove = await blocXTacToe.getSupportedTokens();
      expect(tokensAfterRemove).to.not.include(mockToken);
      expect(tokensAfterRemove.length).to.equal(tokensAfterAdd.length - 1);
    });
  });

  // ============ TEST 3: Player Registration - getPlayerByUsername() ============

  describe("Player Registration - getPlayerByUsername()", function () {
    it("Should return correct player data by username", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("Alice");

      const [address, player] = await blocXTacToe.getPlayerByUsername("Alice");

      expect(address).to.equal(player1.address);
      // Player struct is returned as array: [username, wins, losses, draws, totalGames, rating, registered]
      expect(player[0]).to.equal("Alice"); // username
      expect(player[6]).to.be.true; // registered
      expect(player[5]).to.equal(100n); // rating
    });

    it("Should handle non-existent username", async function () {
      const { blocXTacToe } = await loadFixture(deployBlOcXTacToeFixture);

      // Non-existent username should return zero address
      const [address, player] = await blocXTacToe.getPlayerByUsername("NonExistentUser");

      expect(address).to.equal(ethers.ZeroAddress);
      // Player struct will have default values
    });

    it("Should return address and Player struct", async function () {
      const { blocXTacToe, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      const username = "Bob";
      await blocXTacToe.connect(player2).registerPlayer(username);

      const [address, player] = await blocXTacToe.getPlayerByUsername(username);

      expect(address).to.be.a("string");
      expect(address).to.equal(player2.address);
      
      // Player struct is returned as array: [username, wins, losses, draws, totalGames, rating, registered]
      expect(player).to.be.an("array");
      expect(player[0]).to.equal(username); // username
      expect(player[1]).to.equal(0n); // wins
      expect(player[2]).to.equal(0n); // losses
      expect(player[3]).to.equal(0n); // draws
      expect(player[4]).to.equal(0n); // totalGames
      expect(player[5]).to.equal(100n); // rating
      expect(player[6]).to.be.true; // registered
    });
  });

  // ============ TEST 4: Game Functions - createGame() Edge Cases ============

  describe("Game Functions - createGame() Edge Cases", function () {
    it("Should allow creating game with 5x5 board", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");

      await expect(blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 5, { value: betAmount }))
        .to.emit(blocXTacToe, "GameCreated");

      const game = await blocXTacToe.getGame(0);
      expect(game.boardSize).to.equal(5);
    });

    it("Should allow creating game with 7x7 board", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");

      await expect(blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 7, { value: betAmount }))
        .to.emit(blocXTacToe, "GameCreated");

      const game = await blocXTacToe.getGame(0);
      expect(game.boardSize).to.equal(7);
    });

    it("Should revert if board size is not 3, 5, or 7", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");

      // Test invalid board sizes
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 2, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidSize");

      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 4, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidSize");

      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 6, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidSize");

      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 8, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidSize");
    });

    it("Should revert if token is not supported", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");

      // Use a random address as unsupported token
      const unsupportedToken = ethers.Wallet.createRandom().address;

      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, unsupportedToken, 3, { value: 0 })
      ).to.be.revertedWithCustomError(blocXTacToe, "TokenNotSup");
    });

    it("Should validate move index for 5x5 board (max 24)", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");

      // 5x5 board has 25 cells (0-24), so 25 should be invalid
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 25, ethers.ZeroAddress, 5, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidMove");
    });

    it("Should validate move index for 7x7 board (max 48)", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");

      // 7x7 board has 49 cells (0-48), so 49 should be invalid
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 49, ethers.ZeroAddress, 7, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidMove");
    });
  });

});

