import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { BlOcXTacToe, ERC20Mock } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ERC20Mock } from "../typechain-types";

describe("BlOcXTacToe - Additional Test Coverage (T2)", function () {
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

  // ============ TEST 5: Game Functions - joinGame() Edge Cases ============

  describe("Game Functions - joinGame() Edge Cases", function () {
    it("Should allow joining game with ERC20 token payment", async function () {
      const { blocXTacToe, owner, admin, player1, player2, erc20Mock, erc20Address } = await loadFixture(deployBlOcXTacToeFixture);

      // Setup: Add admin and support token
      await blocXTacToe.connect(owner).addAdmin(admin.address);
      await blocXTacToe.connect(admin).setSupportedToken(erc20Address, true, "TestToken");

      // Register players
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");

      // Mint tokens and approve
      const betAmount = ethers.parseEther("100");
      await erc20Mock.mint(player1.address, betAmount);
      await erc20Mock.mint(player2.address, betAmount);
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount);
      await erc20Mock.connect(player2).approve(await blocXTacToe.getAddress(), betAmount);

      // Player1 creates game with ERC20
      await blocXTacToe.connect(player1).createGame(betAmount, 0, erc20Address, 3);

      // Player2 joins game with ERC20
      await expect(blocXTacToe.connect(player2).joinGame(0, 1))
        .to.emit(blocXTacToe, "GameJoined");

      // Verify game state
      const game = await blocXTacToe.getGame(0);
      expect(game.playerTwo).to.equal(player2.address);
      expect(game.tokenAddress).to.equal(erc20Address);
    });

    it("Should revert if sending ETH when game expects ERC20 token", async function () {
      const { blocXTacToe, owner, admin, player1, player2, erc20Mock, erc20Address } = await loadFixture(deployBlOcXTacToeFixture);

      // Setup
      await blocXTacToe.connect(owner).addAdmin(admin.address);
      await blocXTacToe.connect(admin).setSupportedToken(erc20Address, true, "TestToken");
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");

      const betAmount = ethers.parseEther("100");

      // Mint tokens and approve
      await erc20Mock.mint(player1.address, betAmount);
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount);

      // Create game with ERC20
      await blocXTacToe.connect(player1).createGame(betAmount, 0, erc20Address, 3);

      // Try to join with ETH instead of ERC20
      await expect(
        blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "BetMismatch");
    });

    it("Should revert if sending ERC20 when game expects ETH", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      // Register players
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");

      const betAmount = ethers.parseEther("0.01");

      // Create game with ETH (tokenAddress = ZeroAddress)
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });

      // Try to join without ETH (no value sent, which would be correct for ERC20 but wrong here)
      await expect(blocXTacToe.connect(player2).joinGame(0, 1))
        .to.be.revertedWithCustomError(blocXTacToe, "BetMismatch");
    });

    it("Should revert if ETH payment amount is wrong", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");

      const betAmount = ethers.parseEther("0.01");
      const wrongAmount = ethers.parseEther("0.005"); // Wrong amount

      // Create game with ETH
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, 3, { value: betAmount });

      // Try to join with wrong ETH amount
      await expect(
        blocXTacToe.connect(player2).joinGame(0, 1, { value: wrongAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "BetMismatch");
    });

    it("Should revert if ERC20 allowance is insufficient", async function () {
      const { blocXTacToe, owner, admin, player1, player2, erc20Mock, erc20Address } = await loadFixture(deployBlOcXTacToeFixture);

      // Setup
      await blocXTacToe.connect(owner).addAdmin(admin.address);
      await blocXTacToe.connect(admin).setSupportedToken(erc20Address, true, "TestToken");
      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");

      const betAmount = ethers.parseEther("100");

      // Mint tokens but don't approve enough
      await erc20Mock.mint(player1.address, betAmount);
      await erc20Mock.mint(player2.address, betAmount);
      await erc20Mock.connect(player1).approve(await blocXTacToe.getAddress(), betAmount);
      // Player2 approves less than betAmount
      await erc20Mock.connect(player2).approve(await blocXTacToe.getAddress(), ethers.parseEther("50"));

      // Create game
      await blocXTacToe.connect(player1).createGame(betAmount, 0, erc20Address, 3);

      // Try to join - should fail due to insufficient allowance
      await expect(blocXTacToe.connect(player2).joinGame(0, 1))
        .to.be.reverted; // ERC20 transferFrom will revert
    });
  });

  // ============ TEST 6: Game Functions - play() Edge Cases ============

  describe("Game Functions - play() Edge Cases", function () {
    async function setupGameFixture(boardSize: number = 3) {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      const betAmount = ethers.parseEther("0.01");

      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, boardSize, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });

      return { blocXTacToe, player1, player2 };
    }

    it("Should detect horizontal win on 5x5 board", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 5));

      // 5x5 board: create horizontal win in row 2 (positions 10, 11, 12)
      // X at 0, O at 1 (from setup)
      // X plays at 10 (row 2, col 0)
      await blocXTacToe.connect(player1).play(0, 10);
      // O plays at 13 (row 2, col 3) - to avoid blocking
      await blocXTacToe.connect(player2).play(0, 13);
      // X plays at 11 (row 2, col 1)
      await blocXTacToe.connect(player1).play(0, 11);
      // O plays at 14 (row 2, col 4)
      await blocXTacToe.connect(player2).play(0, 14);
      // X plays at 12 (row 2, col 2) - horizontal win!
      await blocXTacToe.connect(player1).play(0, 12);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect vertical win on 5x5 board", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 5));

      // 5x5 board: column 2 has positions 2, 7, 12
      // X at 0, O at 1 (from setup)
      // X plays at 2 (column 2, row 0)
      await blocXTacToe.connect(player1).play(0, 2);
      // O plays at 3
      await blocXTacToe.connect(player2).play(0, 3);
      // X plays at 7 (column 2, row 1)
      await blocXTacToe.connect(player1).play(0, 7);
      // O plays at 4
      await blocXTacToe.connect(player2).play(0, 4);
      // X plays at 12 (column 2, row 2) - vertical win!
      await blocXTacToe.connect(player1).play(0, 12);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect main diagonal win on 5x5 board", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 5));

      // 5x5 board: main diagonal starting at 0: 0, 6, 12
      // X at 0 (from setup), O at 1
      // X plays at 6
      await blocXTacToe.connect(player1).play(0, 6);
      // O plays at 2
      await blocXTacToe.connect(player2).play(0, 2);
      // X plays at 12 - main diagonal win!
      await blocXTacToe.connect(player1).play(0, 12);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect anti-diagonal win on 5x5 board", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 5));

      // 5x5 board: anti-diagonal starting at 2: 2, 6, 10
      // X at 0, O at 1 (from setup)
      // X plays at 2
      await blocXTacToe.connect(player1).play(0, 2);
      // O plays at 3
      await blocXTacToe.connect(player2).play(0, 3);
      // X plays at 6
      await blocXTacToe.connect(player1).play(0, 6);
      // O plays at 4
      await blocXTacToe.connect(player2).play(0, 4);
      // X plays at 10 - anti-diagonal win!
      await blocXTacToe.connect(player1).play(0, 10);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect horizontal win on 7x7 board", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 7));

      // 7x7 board: row 3 has positions 21, 22, 23
      // X at 0, O at 1 (from setup)
      // X plays at 21 (row 3, col 0)
      await blocXTacToe.connect(player1).play(0, 21);
      // O plays at 24 (row 3, col 3) - to avoid blocking
      await blocXTacToe.connect(player2).play(0, 24);
      // X plays at 22 (row 3, col 1)
      await blocXTacToe.connect(player1).play(0, 22);
      // O plays at 25 (row 3, col 4)
      await blocXTacToe.connect(player2).play(0, 25);
      // X plays at 23 (row 3, col 2) - horizontal win!
      await blocXTacToe.connect(player1).play(0, 23);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect vertical win on 7x7 board", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 7));

      // 7x7 board: column 3 has positions 3, 10, 17
      // X at 0, O at 1 (from setup)
      // X plays at 3
      await blocXTacToe.connect(player1).play(0, 3);
      // O plays at 4
      await blocXTacToe.connect(player2).play(0, 4);
      // X plays at 10
      await blocXTacToe.connect(player1).play(0, 10);
      // O plays at 5
      await blocXTacToe.connect(player2).play(0, 5);
      // X plays at 17 - vertical win!
      await blocXTacToe.connect(player1).play(0, 17);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect main diagonal win on 7x7 board", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 7));

      // 7x7 board: main diagonal starting at 0: 0, 8, 16
      // X at 0 (from setup), O at 1
      // X plays at 8
      await blocXTacToe.connect(player1).play(0, 8);
      // O plays at 2
      await blocXTacToe.connect(player2).play(0, 2);
      // X plays at 16 - main diagonal win!
      await blocXTacToe.connect(player1).play(0, 16);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect draw on 5x5 board (all cells filled, no winner)", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 5));

      // Fill board systematically to avoid wins - use a checkerboard pattern
      // X at 0, O at 1 (from setup)
      // We need to fill remaining 23 positions without creating 3-in-a-row
      // Pattern: alternate players in a way that prevents any consecutive 3
      const moves = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

      // Play moves alternately starting with player1 (X)
      for (let i = 0; i < moves.length; i++) {
        const pos = moves[i];
        // Alternate: player1 (X), player2 (O), player1, player2, etc.
        if (i % 2 === 0) {
          await blocXTacToe.connect(player1).play(0, pos);
        } else {
          await blocXTacToe.connect(player2).play(0, pos);
        }
      }

      const game = await blocXTacToe.getGame(0);
      // Game should end in draw (all cells filled, no winner)
      expect(game.status).to.equal(1); // Ended
      expect(game.winner).to.equal(ethers.ZeroAddress); // No winner
    });

    it("Should revert if move index exceeds board size", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 5));

      // 5x5 board has 25 cells (0-24), so 25 should be invalid
      await expect(blocXTacToe.connect(player1).play(0, 25))
        .to.be.revertedWithCustomError(blocXTacToe, "InvalidMove");
    });

    it("Should revert if trying to play on occupied cell", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 3));

      // Position 0 is already occupied by X from createGame
      await expect(blocXTacToe.connect(player1).play(0, 0))
        .to.be.revertedWithCustomError(blocXTacToe, "Occupied");
    });

    it("Should revert if not player's turn", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture.bind(null, 3));

      // After setup: X at 0, O at 1, now it's X's turn
      // Player2 (O) tries to play out of turn
      await expect(blocXTacToe.connect(player2).play(0, 2))
        .to.be.revertedWithCustomError(blocXTacToe, "NotTurn");
    });
  });

});