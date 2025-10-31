// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TicTacToe
 * @notice A decentralized Tic Tac Toe game with ETH betting and timeout/forfeit mechanism
 * @dev Implements anti-griefing timeout protection with 24-hour move limit
 */
contract TicTacToe is ReentrancyGuard {
    // Constants
    uint256 public constant MOVE_TIMEOUT = 24 hours;

    // Custom Errors
    error InvalidGameId();
    error GameNotActive();
    error InvalidMove();
    error NotYourTurn();
    error InvalidBetAmount();
    error BetMismatch();
    error GameAlreadyStarted();
    error CellOccupied();
    error TimeoutNotReached();
    error UnauthorizedForfeit();

    // Enums
    enum GameStatus {
        Active,
        Ended,
        Forfeited
    }

    // Structs
    struct Game {
        address playerOne;
        address playerTwo; // address(0) until joined
        uint256 betAmount; // in wei
        uint8[9] board; // 0=empty, 1=X, 2=O
        bool isPlayerOneTurn; // true=>X turn
        address winner; // address(0) until decided
        uint256 lastMoveTimestamp; // unix timestamp of last move
        GameStatus status; // game status
    }

    // State
    mapping(uint256 => Game) public games;
    uint256 private gameIdCounter;

    // Events
    event GameCreated(
        uint256 indexed gameId,
        address indexed playerOne,
        uint256 betAmount,
        uint8 moveIndex
    );
    event GameJoined(
        uint256 indexed gameId,
        address indexed playerTwo,
        uint8 moveIndex
    );
    event MovePlayed(
        uint256 indexed gameId,
        address indexed player,
        uint8 moveIndex
    );
    event GameWon(
        uint256 indexed gameId,
        address indexed winner,
        uint256 payout
    );
    event GameForfeited(uint256 indexed gameId, address indexed winner);

    // Modifiers
    modifier validGame(uint256 gameId) {
        if (gameId >= gameIdCounter) revert InvalidGameId();
        _;
    }

    modifier gameActive(uint256 gameId) {
        if (games[gameId].status != GameStatus.Active) revert GameNotActive();
        _;
    }

    modifier checkTimeout(uint256 gameId) {
        Game storage game = games[gameId];
        if (
            game.lastMoveTimestamp > 0 &&
            block.timestamp > game.lastMoveTimestamp + MOVE_TIMEOUT
        ) {
            // Timeout occurred - allow forfeit but don't auto-forfeit
            _;
        } else {
            _;
        }
    }

    /**
     * @notice Create a new game with a bet and make the first move
     * @param betAmount The amount of ETH to bet (in wei)
     * @param moveIndex The position (0-8) for the first move
     */
    function createGame(
        uint256 betAmount,
        uint8 moveIndex
    ) external payable nonReentrant {
        if (betAmount == 0) revert InvalidBetAmount();
        if (msg.value != betAmount) revert BetMismatch();
        if (moveIndex > 8) revert InvalidMove();

        uint256 gameId = gameIdCounter++;

        Game storage game = games[gameId];
        game.playerOne = msg.sender;
        game.betAmount = betAmount;
        game.isPlayerOneTurn = false; // After first move, it's player two's turn
        game.status = GameStatus.Active;
        game.lastMoveTimestamp = block.timestamp;

        // Place first move (X)
        game.board[moveIndex] = 1;

        emit GameCreated(gameId, msg.sender, betAmount, moveIndex);
        emit MovePlayed(gameId, msg.sender, moveIndex);
    }

    /**
     * @notice Join an existing game and make the first move as player two
     * @param gameId The ID of the game to join
     * @param moveIndex The position (0-8) for the first move
     */
    function joinGame(
        uint256 gameId,
        uint8 moveIndex
    ) external payable nonReentrant validGame(gameId) gameActive(gameId) {
        Game storage game = games[gameId];

        if (game.playerTwo != address(0)) revert GameAlreadyStarted();
        if (msg.value != game.betAmount) revert BetMismatch();
        if (moveIndex > 8) revert InvalidMove();
        if (game.board[moveIndex] != 0) revert CellOccupied();

        game.playerTwo = msg.sender;
        game.board[moveIndex] = 2; // O
        game.isPlayerOneTurn = true; // Now it's player one's turn
        game.lastMoveTimestamp = block.timestamp;

        emit GameJoined(gameId, msg.sender, moveIndex);
        emit MovePlayed(gameId, msg.sender, moveIndex);

        // Check for winner after join move
        _checkWinner(gameId);
    }

    /**
     * @notice Make a move in an ongoing game
     * @param gameId The ID of the game
     * @param moveIndex The position (0-8) for the move
     */
    function play(
        uint256 gameId,
        uint8 moveIndex
    )
        external
        nonReentrant
        validGame(gameId)
        gameActive(gameId)
        checkTimeout(gameId)
    {
        Game storage game = games[gameId];

        if (game.playerTwo == address(0)) revert GameNotActive();
        if (moveIndex > 8) revert InvalidMove();
        if (game.board[moveIndex] != 0) revert CellOccupied();

        // Check turn
        if (game.isPlayerOneTurn && msg.sender != game.playerOne)
            revert NotYourTurn();
        if (!game.isPlayerOneTurn && msg.sender != game.playerTwo)
            revert NotYourTurn();

        // Make move
        uint8 mark = game.isPlayerOneTurn ? 1 : 2;
        game.board[moveIndex] = mark;
        game.isPlayerOneTurn = !game.isPlayerOneTurn;
        game.lastMoveTimestamp = block.timestamp;

        emit MovePlayed(gameId, msg.sender, moveIndex);

        // Check for winner
        _checkWinner(gameId);
    }

    /**
     * @notice Forfeit a game due to opponent timeout
     * @param gameId The ID of the game to forfeit
     */
    function forfeitGame(
        uint256 gameId
    ) external nonReentrant validGame(gameId) gameActive(gameId) {
        Game storage game = games[gameId];

        // Game must have both players
        if (game.playerTwo == address(0)) revert GameNotActive();

        // Check if timeout has occurred
        if (block.timestamp <= game.lastMoveTimestamp + MOVE_TIMEOUT) {
            revert TimeoutNotReached();
        }

        // Determine who can forfeit (the player whose turn it is NOT)
        address winner;

        if (game.isPlayerOneTurn) {
            // It's player one's turn, so player two can forfeit
            if (msg.sender != game.playerTwo) revert UnauthorizedForfeit();
            winner = game.playerTwo;
        } else {
            // It's player two's turn, so player one can forfeit
            if (msg.sender != game.playerOne) revert UnauthorizedForfeit();
            winner = game.playerOne;
        }

        // Update game state
        game.status = GameStatus.Forfeited;
        game.winner = winner;

        // Calculate payout
        uint256 payout = game.betAmount * 2;

        emit GameForfeited(gameId, winner);

        // Transfer funds to winner
        (bool success, ) = winner.call{value: payout}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Get time remaining for current move
     * @param gameId The ID of the game
     * @return timeRemaining Time remaining in seconds (0 if timeout reached)
     */
    function getTimeRemaining(
        uint256 gameId
    ) external view validGame(gameId) returns (uint256 timeRemaining) {
        Game storage game = games[gameId];

        if (game.lastMoveTimestamp == 0 || game.status != GameStatus.Active) {
            return 0;
        }

        uint256 deadline = game.lastMoveTimestamp + MOVE_TIMEOUT;

        if (block.timestamp >= deadline) {
            return 0;
        }

        return deadline - block.timestamp;
    }

    /**
     * @notice Get game details
     * @param gameId The ID of the game
     * @return game The game struct
     */
    function getGame(
        uint256 gameId
    ) external view validGame(gameId) returns (Game memory) {
        return games[gameId];
    }

    /**
     * @notice Get the latest game ID (total number of games created)
     * @return The latest game ID
     */
    function getLatestGameId() external view returns (uint256) {
        return gameIdCounter;
    }

    /**
     * @notice Internal function to check for a winner
     * @param gameId The ID of the game
     */
    function _checkWinner(uint256 gameId) internal {
        Game storage game = games[gameId];
        uint8[9] memory board = game.board;

        // Winning combinations
        uint8[3][8] memory winningCombos = [
            [0, 1, 2], // Top row
            [3, 4, 5], // Middle row
            [6, 7, 8], // Bottom row
            [0, 3, 6], // Left column
            [1, 4, 7], // Middle column
            [2, 5, 8], // Right column
            [0, 4, 8], // Diagonal \
            [2, 4, 6] // Diagonal /
        ];

        for (uint256 i = 0; i < 8; i++) {
            uint8 a = board[winningCombos[i][0]];
            uint8 b = board[winningCombos[i][1]];
            uint8 c = board[winningCombos[i][2]];

            if (a != 0 && a == b && b == c) {
                // We have a winner
                address winner = a == 1 ? game.playerOne : game.playerTwo;
                game.winner = winner;
                game.status = GameStatus.Ended;

                uint256 payout = game.betAmount * 2;

                emit GameWon(gameId, winner, payout);

                // Transfer funds to winner
                (bool success, ) = winner.call{value: payout}("");
                require(success, "Transfer failed");

                return;
            }
        }

        // Check for draw (all cells filled)
        bool isDraw = true;
        for (uint256 i = 0; i < 9; i++) {
            if (board[i] == 0) {
                isDraw = false;
                break;
            }
        }

        if (isDraw) {
            game.status = GameStatus.Ended;

            // Return bets to both players in case of draw
            (bool success1, ) = game.playerOne.call{value: game.betAmount}("");
            (bool success2, ) = game.playerTwo.call{value: game.betAmount}("");
            require(success1 && success2, "Transfer failed");
        }
    }
}
