import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { BlOcXTacToe } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BlOcXTacToe - Full Coverage Tests", function () {
  // Deploy contract fixture
  async function deployBlOcXTacToeFixture() {
    const [owner, admin, player1, player2, player3, feeRecipient] = await ethers.getSigners();

    const BlOcXTacToeFactory = await ethers.getContractFactory("BlOcXTacToe");
    const blocXTacToe = await BlOcXTacToeFactory.deploy();

    await blocXTacToe.waitForDeployment();
    const contractAddress = await blocXTacToe.getAddress();

    return { blocXTacToe, owner, admin, player1, player2, player3, feeRecipient, contractAddress };
  }

  describe("Deployment & Initialization", function () {
    it("Should deploy with correct initial values", async function () {
      const { blocXTacToe, owner } = await loadFixture(deployBlOcXTacToeFixture);

      expect(await blocXTacToe.moveTimeout()).to.equal(24 * 60 * 60); // 24 hours
      expect(await blocXTacToe.platformFeePercent()).to.equal(0);
      expect(await blocXTacToe.platformFeeRecipient()).to.equal(owner.address);
      expect(await blocXTacToe.owner()).to.equal(owner.address);
      expect(await blocXTacToe.admins(owner.address)).to.be.true;
      expect(await blocXTacToe.supportedTokens(ethers.ZeroAddress)).to.be.true;
    });

    it("Should have ETH as default supported token", async function () {
      const { blocXTacToe } = await loadFixture(deployBlOcXTacToeFixture);

      const supportedTokens = await blocXTacToe.getSupportedTokens();
      expect(supportedTokens).to.include(ethers.ZeroAddress);
      expect(await blocXTacToe.isTokenSupported(ethers.ZeroAddress)).to.be.true;
    });
  });

  describe("Admin Functions", function () {
    describe("addAdmin", function () {
      it("Should allow owner to add admin", async function () {
        const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

        await expect(blocXTacToe.connect(owner).addAdmin(admin.address))
          .to.emit(blocXTacToe, "AdminAdded")
          .withArgs(admin.address);

        expect(await blocXTacToe.admins(admin.address)).to.be.true;
      });

      it("Should revert if non-owner tries to add admin", async function () {
        const { blocXTacToe, admin, player1 } = await loadFixture(deployBlOcXTacToeFixture);

        await expect(blocXTacToe.connect(player1).addAdmin(admin.address))
          .to.be.revertedWithCustomError(blocXTacToe, "OwnableUnauthorizedAccount");
      });
    });

    describe("removeAdmin", function () {
      it("Should allow owner to remove admin", async function () {
        const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.connect(owner).addAdmin(admin.address);
        await expect(blocXTacToe.connect(owner).removeAdmin(admin.address))
          .to.emit(blocXTacToe, "AdminRemoved")
          .withArgs(admin.address);

        expect(await blocXTacToe.admins(admin.address)).to.be.false;
      });
    });

    describe("setMoveTimeout", function () {
      it("Should allow admin to set move timeout", async function () {
        const { blocXTacToe, owner, admin } = await loadFixture(deployBlOcXTacToeFixture);

        const newTimeout = 12 * 60 * 60; // 12 hours
        await blocXTacToe.connect(owner).addAdmin(admin.address);
        
        await expect(blocXTacToe.connect(admin).setMoveTimeout(newTimeout))
          .to.emit(blocXTacToe, "TimeoutUpdated")
          .withArgs(newTimeout);

        expect(await blocXTacToe.moveTimeout()).to.equal(newTimeout);
      });

      it("Should revert if timeout is 0", async function () {
        const { blocXTacToe, admin } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.addAdmin(admin.address);
        await expect(blocXTacToe.connect(admin).setMoveTimeout(0))
          .to.be.revertedWithCustomError(blocXTacToe, "InvalidTimeout");
      });

      it("Should revert if timeout > 7 days", async function () {
        const { blocXTacToe, admin } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.addAdmin(admin.address);
        await expect(blocXTacToe.connect(admin).setMoveTimeout(8 * 24 * 60 * 60 + 1))
          .to.be.revertedWithCustomError(blocXTacToe, "InvalidTimeout");
      });

      it("Should revert if non-admin tries to set timeout", async function () {
        const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

        await expect(blocXTacToe.connect(player1).setMoveTimeout(12 * 60 * 60))
          .to.be.revertedWithCustomError(blocXTacToe, "NotAdmin");
      });
    });

    describe("setPlatformFee", function () {
      it("Should allow admin to set platform fee", async function () {
        const { blocXTacToe, admin } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.addAdmin(admin.address);
        const newFee = 100; // 1%

        await expect(blocXTacToe.connect(admin).setPlatformFee(newFee))
          .to.emit(blocXTacToe, "PlatformFeeUpdated")
          .withArgs(newFee);

        expect(await blocXTacToe.platformFeePercent()).to.equal(newFee);
      });

      it("Should revert if fee > 1000 (10%)", async function () {
        const { blocXTacToe, admin } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.addAdmin(admin.address);
        await expect(blocXTacToe.connect(admin).setPlatformFee(1001))
          .to.be.revertedWithCustomError(blocXTacToe, "InvalidFeePercent");
      });
    });

    describe("setPlatformFeeRecipient", function () {
      it("Should allow admin to set fee recipient", async function () {
        const { blocXTacToe, admin, feeRecipient } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.addAdmin(admin.address);
        await blocXTacToe.connect(admin).setPlatformFeeRecipient(feeRecipient.address);

        expect(await blocXTacToe.platformFeeRecipient()).to.equal(feeRecipient.address);
      });

      it("Should revert if recipient is zero address", async function () {
        const { blocXTacToe, admin } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.addAdmin(admin.address);
        await expect(blocXTacToe.connect(admin).setPlatformFeeRecipient(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(blocXTacToe, "InvalidPlayerAddress");
      });
    });

    describe("setSupportedToken", function () {
      it("Should allow admin to add supported token", async function () {
        const { blocXTacToe, admin, player1 } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.addAdmin(admin.address);
        const tokenAddress = player1.address; // Mock token address

        await expect(blocXTacToe.connect(admin).setSupportedToken(tokenAddress, true))
          .to.emit(blocXTacToe, "TokenSupported")
          .withArgs(tokenAddress, true);

        expect(await blocXTacToe.supportedTokens(tokenAddress)).to.be.true;
        expect(await blocXTacToe.isTokenSupported(tokenAddress)).to.be.true;
      });

      it("Should allow admin to remove supported token", async function () {
        const { blocXTacToe, admin, player1 } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.addAdmin(admin.address);
        const tokenAddress = player1.address;

        await blocXTacToe.connect(admin).setSupportedToken(tokenAddress, true);
        await blocXTacToe.connect(admin).setSupportedToken(tokenAddress, false);

        expect(await blocXTacToe.supportedTokens(tokenAddress)).to.be.false;
      });

      it("Should maintain supported tokens list correctly", async function () {
        const { blocXTacToe, admin, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.addAdmin(admin.address);
        const token1 = player1.address;
        const token2 = player2.address;

        await blocXTacToe.connect(admin).setSupportedToken(token1, true);
        await blocXTacToe.connect(admin).setSupportedToken(token2, true);

        const tokens = await blocXTacToe.getSupportedTokens();
        expect(tokens).to.include(token1);
        expect(tokens).to.include(token2);

        await blocXTacToe.connect(admin).setSupportedToken(token1, false);
        const tokensAfter = await blocXTacToe.getSupportedTokens();
        expect(tokensAfter).to.not.include(token1);
        expect(tokensAfter).to.include(token2);
      });
    });

    describe("pause/unpause", function () {
      it("Should allow owner to pause contract", async function () {
        const { blocXTacToe, owner } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.connect(owner).pause();
        expect(await blocXTacToe.paused()).to.be.true;
      });

      it("Should allow owner to unpause contract", async function () {
        const { blocXTacToe, owner } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.connect(owner).pause();
        await blocXTacToe.connect(owner).unpause();
        expect(await blocXTacToe.paused()).to.be.false;
      });

      it("Should revert game creation when paused", async function () {
        const { blocXTacToe, owner, player1 } = await loadFixture(deployBlOcXTacToeFixture);

        await blocXTacToe.connect(player1).registerPlayer("player1");
        await blocXTacToe.connect(owner).pause();

        const betAmount = ethers.parseEther("0.01");
        await expect(
          blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount })
        ).to.be.revertedWithCustomError(blocXTacToe, "EnforcedPause");
      });
    });
  });

  describe("Player Registration", function () {
    it("Should allow player to register with valid username", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await expect(blocXTacToe.connect(player1).registerPlayer("Alice"))
        .to.emit(blocXTacToe, "PlayerRegistered")
        .withArgs(player1.address, "Alice");

      const player = await blocXTacToe.getPlayer(player1.address);
      expect(player.username).to.equal("Alice");
      expect(player.registered).to.be.true;
      expect(player.rating).to.equal(1000);
      expect(player.wins).to.equal(0);
    });

    it("Should revert if username is empty", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await expect(blocXTacToe.connect(player1).registerPlayer(""))
        .to.be.revertedWithCustomError(blocXTacToe, "UsernameInvalid");
    });

    it("Should revert if username > 32 characters", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      const longUsername = "a".repeat(33);
      await expect(blocXTacToe.connect(player1).registerPlayer(longUsername))
        .to.be.revertedWithCustomError(blocXTacToe, "UsernameInvalid");
    });

    it("Should revert if username is already taken", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("Alice");
      await expect(blocXTacToe.connect(player2).registerPlayer("Alice"))
        .to.be.revertedWithCustomError(blocXTacToe, "UsernameTaken");
    });

    it("Should revert if player already registered", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("Alice");
      await expect(blocXTacToe.connect(player1).registerPlayer("Bob"))
        .to.be.revertedWithCustomError(blocXTacToe, "UsernameInvalid");
    });

    it("Should allow getPlayerByUsername to find player", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("Alice");
      const [address, player] = await blocXTacToe.getPlayerByUsername("Alice");

      expect(address).to.equal(player1.address);
      expect(player.username).to.equal("Alice");
    });
  });

  describe("Game Creation & Joining", function () {
    it("Should allow registered player to create game", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");

      await expect(blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount }))
        .to.emit(blocXTacToe, "GameCreated")
        .withArgs(0, player1.address, betAmount, 0, ethers.ZeroAddress);

      const game = await blocXTacToe.getGame(0);
      expect(game.playerOne).to.equal(player1.address);
      expect(game.betAmount).to.equal(betAmount);
      expect(game.board[0]).to.equal(1); // X placed
    });

    it("Should revert if player not registered", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      const betAmount = ethers.parseEther("0.01");
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "NotRegistered");
    });

    it("Should revert if bet amount is 0", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await expect(
        blocXTacToe.connect(player1).createGame(0, 0, ethers.ZeroAddress, { value: 0 })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidBetAmount");
    });

    it("Should revert if move index > 8", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 9, ethers.ZeroAddress, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "InvalidMove");
    });

    it("Should revert if ETH value doesn't match bet amount", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");
      await expect(
        blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: ethers.parseEther("0.02") })
      ).to.be.revertedWithCustomError(blocXTacToe, "BetMismatch");
    });

    it("Should allow second player to join game", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      const betAmount = ethers.parseEther("0.01");

      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });

      await expect(blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount }))
        .to.emit(blocXTacToe, "GameJoined")
        .withArgs(0, player2.address, 1);

      const game = await blocXTacToe.getGame(0);
      expect(game.playerTwo).to.equal(player2.address);
      expect(game.board[1]).to.equal(2); // O placed
    });

    it("Should revert if player tries to join their own game", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      const betAmount = ethers.parseEther("0.01");

      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });
      await expect(
        blocXTacToe.connect(player1).joinGame(0, 1, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "CannotPlaySelf");
    });

    it("Should revert if game already has two players", async function () {
      const { blocXTacToe, player1, player2, player3 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      await blocXTacToe.connect(player3).registerPlayer("player3");
      const betAmount = ethers.parseEther("0.01");

      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });

      await expect(
        blocXTacToe.connect(player3).joinGame(0, 2, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "GameAlreadyStarted");
    });
  });

  describe("Game Play", function () {
    async function setupGameFixture() {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      const betAmount = ethers.parseEther("0.01");

      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });

      return { blocXTacToe, player1, player2, betAmount };
    }

    it("Should allow player to make valid move", async function () {
      const { blocXTacToe, player1 } = await loadFixture(setupGameFixture);

      await expect(blocXTacToe.connect(player1).play(0, 2))
        .to.emit(blocXTacToe, "MovePlayed")
        .withArgs(0, player1.address, 2);

      const game = await blocXTacToe.getGame(0);
      expect(game.board[2]).to.equal(1); // X
    });

    it("Should revert if not player's turn", async function () {
      const { blocXTacToe, player1 } = await loadFixture(setupGameFixture);

      // Player1 just created game, so it's player2's turn
      await expect(blocXTacToe.connect(player1).play(0, 2))
        .to.be.revertedWithCustomError(blocXTacToe, "NotYourTurn");
    });

    it("Should revert if move index > 8", async function () {
      const { blocXTacToe, player2 } = await loadFixture(setupGameFixture);

      await expect(blocXTacToe.connect(player2).play(0, 9))
        .to.be.revertedWithCustomError(blocXTacToe, "InvalidMove");
    });

    it("Should revert if cell is already occupied", async function () {
      const { blocXTacToe, player2 } = await loadFixture(setupGameFixture);

      // Cell 0 is already occupied by player1
      await expect(blocXTacToe.connect(player2).play(0, 0))
        .to.be.revertedWithCustomError(blocXTacToe, "CellOccupied");
    });

    it("Should detect horizontal win", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture);

      // Game setup: player1 (X) at 0, player2 (O) at 1
      // Player1's turn: play at 2 (horizontal win)
      await blocXTacToe.connect(player1).play(0, 2);
      // Player2's turn: play at 3
      await blocXTacToe.connect(player2).play(0, 3);
      // Player1's turn: play at 4 (should not win yet)
      await blocXTacToe.connect(player1).play(0, 4);
      // Player2's turn: play at 5
      await blocXTacToe.connect(player2).play(0, 5);
      // Player1's turn: play at 6 (horizontal win: 0,2,4,6)
      await blocXTacToe.connect(player1).play(0, 6);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
      expect(game.status).to.equal(1); // Ended
    });

    it("Should detect vertical win", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture);

      // Vertical win for player1 (X): 0, 3, 6
      await blocXTacToe.connect(player1).play(0, 3);
      await blocXTacToe.connect(player2).play(0, 1);
      await blocXTacToe.connect(player1).play(0, 6);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
    });

    it("Should detect diagonal win", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture);

      // Diagonal win for player1 (X): 0, 4, 8
      await blocXTacToe.connect(player1).play(0, 4);
      await blocXTacToe.connect(player2).play(0, 2);
      await blocXTacToe.connect(player1).play(0, 8);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player1.address);
    });

    it("Should detect draw", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture);

      // Create a draw scenario
      // X at 0, O at 1, X at 2
      await blocXTacToe.connect(player1).play(0, 2);
      // O at 3, X at 4, O at 5
      await blocXTacToe.connect(player2).play(0, 3);
      await blocXTacToe.connect(player1).play(0, 4);
      await blocXTacToe.connect(player2).play(0, 5);
      // X at 6, O at 7, X at 8
      await blocXTacToe.connect(player1).play(0, 6);
      await blocXTacToe.connect(player2).play(0, 7);
      await blocXTacToe.connect(player1).play(0, 8);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(ethers.ZeroAddress); // No winner
      expect(game.status).to.equal(1); // Ended
    });
  });

  describe("Forfeit Game", function () {
    async function setupGameFixture() {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      const betAmount = ethers.parseEther("0.01");

      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });

      return { blocXTacToe, player1, player2, betAmount };
    }

    it("Should allow forfeit after timeout", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture);

      // Advance time past timeout
      const moveTimeout = await blocXTacToe.moveTimeout();
      await time.increase(moveTimeout + 1);

      await expect(blocXTacToe.connect(player1).forfeitGame(0))
        .to.emit(blocXTacToe, "GameForfeited")
        .withArgs(0, player2.address);

      const game = await blocXTacToe.getGame(0);
      expect(game.winner).to.equal(player2.address);
      expect(game.status).to.equal(2); // Forfeited
    });

    it("Should revert if timeout not reached", async function () {
      const { blocXTacToe, player1 } = await loadFixture(setupGameFixture);

      await expect(blocXTacToe.connect(player1).forfeitGame(0))
        .to.be.revertedWithCustomError(blocXTacToe, "TimeoutNotReached");
    });

    it("Should revert if not a player in the game", async function () {
      const { blocXTacToe, player1, player2, player3 } = await loadFixture(setupGameFixture);

      await blocXTacToe.connect(player3).registerPlayer("player3");
      const moveTimeout = await blocXTacToe.moveTimeout();
      await time.increase(moveTimeout + 1);

      await expect(blocXTacToe.connect(player3).forfeitGame(0))
        .to.be.revertedWithCustomError(blocXTacToe, "UnauthorizedForfeit");
    });
  });

  describe("Challenge System", function () {
    async function setupPlayersFixture() {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");

      return { blocXTacToe, player1, player2 };
    }

    it("Should allow creating challenge", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);

      const betAmount = ethers.parseEther("0.01");

      await expect(
        blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, { value: betAmount })
      )
        .to.emit(blocXTacToe, "ChallengeCreated")
        .withArgs(0, player1.address, player2.address, betAmount);

      const challenge = await blocXTacToe.getChallenge(0);
      expect(challenge.challenger).to.equal(player1.address);
      expect(challenge.challenged).to.equal(player2.address);
      expect(challenge.betAmount).to.equal(betAmount);
      expect(challenge.accepted).to.be.false;
    });

    it("Should revert if challenging self", async function () {
      const { blocXTacToe, player1 } = await loadFixture(setupPlayersFixture);

      const betAmount = ethers.parseEther("0.01");
      await expect(
        blocXTacToe.connect(player1).createChallenge(player1.address, betAmount, ethers.ZeroAddress, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "CannotChallengeSelf");
    });

    it("Should allow accepting challenge", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);

      const betAmount = ethers.parseEther("0.01");
      await blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, { value: betAmount });

      await expect(
        blocXTacToe.connect(player2).acceptChallenge(0, 1, { value: betAmount })
      )
        .to.emit(blocXTacToe, "ChallengeAccepted")
        .withArgs(0, 0); // challengeId, gameId

      const challenge = await blocXTacToe.getChallenge(0);
      expect(challenge.accepted).to.be.true;
      expect(challenge.gameId).to.equal(0);
    });

    it("Should revert if challenge already accepted", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);

      const betAmount = ethers.parseEther("0.01");
      await blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, { value: betAmount });
      await blocXTacToe.connect(player2).acceptChallenge(0, 1, { value: betAmount });

      await expect(
        blocXTacToe.connect(player2).acceptChallenge(0, 1, { value: betAmount })
      ).to.be.revertedWithCustomError(blocXTacToe, "ChallengeAlreadyAccepted");
    });

    it("Should track player challenges", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupPlayersFixture);

      const betAmount = ethers.parseEther("0.01");
      await blocXTacToe.connect(player1).createChallenge(player2.address, betAmount, ethers.ZeroAddress, { value: betAmount });

      const challenges = await blocXTacToe.getPlayerChallenges(player1.address);
      expect(challenges).to.include(0);
    });
  });

  describe("View Functions", function () {
    async function setupGameFixture() {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      const betAmount = ethers.parseEther("0.01");

      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });

      return { blocXTacToe, player1, player2 };
    }

    it("Should return correct game data", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture);

      const game = await blocXTacToe.getGame(0);
      expect(game.playerOne).to.equal(player1.address);
      expect(game.playerTwo).to.equal(player2.address);
      expect(game.board[0]).to.equal(1);
      expect(game.board[1]).to.equal(2);
    });

    it("Should return latest game ID", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture);

      expect(await blocXTacToe.getLatestGameId()).to.equal(1); // 0-indexed, so next would be 1

      const betAmount = ethers.parseEther("0.01");
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });
      expect(await blocXTacToe.getLatestGameId()).to.equal(2);
    });

    it("Should return time remaining", async function () {
      const { blocXTacToe } = await loadFixture(setupGameFixture);

      const timeRemaining = await blocXTacToe.getTimeRemaining(0);
      const moveTimeout = await blocXTacToe.moveTimeout();
      expect(timeRemaining).to.be.closeTo(moveTimeout, 10); // Within 10 seconds
    });

    it("Should return leaderboard", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture);

      // Play a game to completion
      await blocXTacToe.connect(player1).play(0, 2);
      await blocXTacToe.connect(player2).play(0, 3);
      await blocXTacToe.connect(player1).play(0, 4);
      await blocXTacToe.connect(player2).play(0, 5);
      await blocXTacToe.connect(player1).play(0, 6); // Player1 wins

      const leaderboard = await blocXTacToe.getLeaderboard(10);
      expect(leaderboard.length).to.be.greaterThan(0);
    });

    it("Should return latest wins", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(setupGameFixture);

      // Play a game to completion
      await blocXTacToe.connect(player1).play(0, 2);
      await blocXTacToe.connect(player2).play(0, 3);
      await blocXTacToe.connect(player1).play(0, 4);
      await blocXTacToe.connect(player2).play(0, 5);
      await blocXTacToe.connect(player1).play(0, 6); // Player1 wins

      const wins = await blocXTacToe.getLatestWins(10);
      expect(wins.length).to.be.greaterThan(0);
      expect(wins[0].winner).to.equal(player1.address);
    });

    it("Should return player data correctly", async function () {
      const { blocXTacToe, player1 } = await loadFixture(setupGameFixture);

      const player = await blocXTacToe.getPlayer(player1.address);
      expect(player.username).to.equal("player1");
      expect(player.registered).to.be.true;
    });
  });

  describe("Edge Cases & Error Handling", function () {
    it("Should revert on invalid game ID", async function () {
      const { blocXTacToe, player1 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await expect(blocXTacToe.connect(player1).play(999, 0))
        .to.be.revertedWithCustomError(blocXTacToe, "InvalidGameId");
    });

    it("Should revert if game is not active", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      const betAmount = ethers.parseEther("0.01");

      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });

      // Play game to completion
      await blocXTacToe.connect(player1).play(0, 2);
      await blocXTacToe.connect(player2).play(0, 3);
      await blocXTacToe.connect(player1).play(0, 4);
      await blocXTacToe.connect(player2).play(0, 5);
      await blocXTacToe.connect(player1).play(0, 6);

      // Try to play after game ended
      await expect(blocXTacToe.connect(player2).play(0, 7))
        .to.be.revertedWithCustomError(blocXTacToe, "GameNotActive");
    });

    it("Should handle multiple games correctly", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      const betAmount = ethers.parseEther("0.01");

      // Create multiple games
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });
      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });

      expect(await blocXTacToe.getLatestGameId()).to.equal(2);

      const game0 = await blocXTacToe.getGame(0);
      const game1 = await blocXTacToe.getGame(1);
      expect(game0.playerOne).to.equal(player1.address);
      expect(game1.playerOne).to.equal(player1.address);
    });
  });

  describe("Player Stats & Rating Updates", function () {
    it("Should update player stats after win", async function () {
      const { blocXTacToe, player1, player2 } = await loadFixture(deployBlOcXTacToeFixture);

      await blocXTacToe.connect(player1).registerPlayer("player1");
      await blocXTacToe.connect(player2).registerPlayer("player2");
      const betAmount = ethers.parseEther("0.01");

      await blocXTacToe.connect(player1).createGame(betAmount, 0, ethers.ZeroAddress, { value: betAmount });
      await blocXTacToe.connect(player2).joinGame(0, 1, { value: betAmount });

      // Player1 wins
      await blocXTacToe.connect(player1).play(0, 2);
      await blocXTacToe.connect(player2).play(0, 3);
      await blocXTacToe.connect(player1).play(0, 4);
      await blocXTacToe.connect(player2).play(0, 5);
      await blocXTacToe.connect(player1).play(0, 6);

      const player1Data = await blocXTacToe.getPlayer(player1.address);
      const player2Data = await blocXTacToe.getPlayer(player2.address);

      expect(player1Data.wins).to.equal(1);
      expect(player1Data.totalGames).to.equal(1);
      expect(player1Data.rating).to.be.greaterThan(1000); // Rating increased

      expect(player2Data.losses).to.equal(1);
      expect(player2Data.totalGames).to.equal(1);
      expect(player2Data.rating).to.be.lessThan(1000); // Rating decreased
    });
  });
});

