// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BlOcXTacToe
 * @notice Enhanced decentralized Tic Tac Toe game with admin controls, usernames, leaderboard, challenges, and multi-token support
 * @dev Implements dynamic parameters, gas optimizations, and advanced features
 */
contract BlOcXTacToe is ReentrancyGuard, Pausable, Ownable {
    // Dynamic Parameters (admin configurable)
    uint256 public moveTimeout; // Dynamic timeout duration
    uint256 public platformFeePercent; // Platform fee percentage (basis points, e.g., 100 = 1%)
    address public platformFeeRecipient; // Address to receive platform fees
    uint256 public kFactor; // Rating change factor (points per win/loss)
    
    // Admin Management
    mapping(address => bool) public admins;
    
    // Supported Tokens (address(0) = native ETH)
    mapping(address => bool) public supportedTokens;
    mapping(address => string) public tokenNames; // Token address => name/symbol
    address[] public supportedTokensList; // List of all supported token addresses
    
    // Player Registration & Stats
    struct Player {
        string username;
        uint256 wins;
        uint256 losses;
        uint256 draws;
        uint256 totalGames;
        uint256 rating; // ELO-style rating
        bool registered;
    }
    
    mapping(address => Player) public players;
    mapping(string => address) public usernameToAddress;
    
    // Leaderboard (top players by rating)
    struct LeaderboardEntry {
        address player;
        string username;
        uint256 rating;
        uint256 wins;
    }
    
    LeaderboardEntry[] public leaderboard;
    uint256 public constant LEADERBOARD_SIZE = 100;
    
    
    // Challenge System
    struct Challenge {
        address challenger;
        string challengerUsername;
        address challenged;
        string challengedUsername;
        uint256 betAmount;
        address tokenAddress; // address(0) for ETH
        uint8 boardSize; // 3, 5, or 7
        uint256 timestamp;
        bool accepted;
        uint256 gameId; // Set when challenge is accepted
    }
    
    mapping(uint256 => Challenge) public challenges;
    uint256 public challengeCounter;
    mapping(address => uint256[]) public playerChallenges; // Challenges by player
    
    // Game Struct (Gas Optimized - Packed)
    struct Game {
        address playerOne;
        address playerTwo;
        uint256 betAmount;
        address tokenAddress; // address(0) for ETH
        uint8 boardSize; // 3, 5, or 7 (default 3 for regular games)
        bool isPlayerOneTurn;
        address winner;
        uint64 lastMoveTimestamp; // Packed timestamp
        GameStatus status;
    }
    
    // Board storage: gameId => cellIndex => value (0=empty, 1=X, 2=O)
    mapping(uint256 => mapping(uint256 => uint8)) public gameBoards;
    
    enum GameStatus {
        Active,
        Ended,
        Forfeited
    }
    
    mapping(uint256 => Game) public games;
    uint256 private gameIdCounter;
    
    // Claimable Rewards (gameId => amount)
    mapping(uint256 => uint256) public claimableRewards;
    mapping(uint256 => bool) public rewardClaimed;
    
    // Custom Errors
    error InvalidId();
    error NotActive();
    error InvalidMove();
    error NotTurn();
    error InvalidBet();
    error BetMismatch();
    error Started();
    error Occupied();
    error Timeout();
    error Unauthorized();
    error SelfPlay();
    error TransferFailed();
    error InvalidAddr();
    error UsernameTaken();
    error InvalidUser();
    error NotReg();
    error NotAdmin();
    error InvalidTimeout();
    error InvalidFee();
    error InvalidK();
    error TokenNotSup();
    error Accepted();
    error SelfChallenge();
    error NoReward();
    error Claimed();
    error NotWinner();
    error InvalidSize();
    error NotFinished();
    
    // Events
    event GameCreated(uint256 indexed gameId, address indexed playerOne, uint256 betAmount, uint8 moveIndex, address tokenAddress);
    event GameJoined(uint256 indexed gameId, address indexed playerTwo, uint8 moveIndex);
    event MovePlayed(uint256 indexed gameId, address indexed player, uint8 moveIndex);
    event GameWon(uint256 indexed gameId, address indexed winner, uint256 payout);
    event GameForfeited(uint256 indexed gameId, address indexed winner);
    event PlayerRegistered(address indexed player, string username);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event TimeoutUpdated(uint256 newTimeout);
    event PlatformFeeUpdated(uint256 newFeePercent);
    event KFactorUpdated(uint256 newKFactor);
    event TokenSupported(address indexed token, bool supported);
    event ChallengeCreated(uint256 indexed challengeId, address indexed challenger, address indexed challenged, uint256 betAmount);
    event ChallengeAccepted(uint256 indexed challengeId, uint256 indexed gameId);
    event RewardClaimed(uint256 indexed gameId, address indexed winner, uint256 amount);
    
    // Modifiers
    modifier validGame(uint256 gameId) {
        if (gameId >= gameIdCounter) revert InvalidId();
        _;
    }
    
    modifier gameActive(uint256 gameId) {
        if (games[gameId].status != GameStatus.Active) revert NotActive();
        _;
    }
    
    modifier onlyAdmin() {
        if (!admins[msg.sender] && msg.sender != owner()) revert NotAdmin();
        _;
    }
    
    modifier onlyRegistered() {
        if (!players[msg.sender].registered) revert NotReg();
        _;
    }
    
    constructor() Ownable(msg.sender) {
        moveTimeout = 24 hours;
        platformFeePercent = 0; // No fee by default
        platformFeeRecipient = msg.sender;
        kFactor = 100; // Default: 100 points per win/loss
        admins[msg.sender] = true;
        supportedTokens[address(0)] = true; // Native ETH supported by default
        tokenNames[address(0)] = "ETH"; // Set default name for ETH
        supportedTokensList.push(address(0)); // Add ETH to list
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function addAdmin(address admin) external onlyOwner {
        admins[admin] = true;
        emit AdminAdded(admin);
    }
    
    function removeAdmin(address admin) external onlyOwner {
        admins[admin] = false;
        emit AdminRemoved(admin);
    }
    
    function setMoveTimeout(uint256 newTimeout) external onlyAdmin {
        if (newTimeout == 0 || newTimeout > 7 days) revert InvalidTimeout();
        moveTimeout = newTimeout;
        emit TimeoutUpdated(newTimeout);
    }
    
    function setPlatformFee(uint256 newFeePercent) external onlyAdmin {
        if (newFeePercent > 1000) revert InvalidFee();
        platformFeePercent = newFeePercent;
        emit PlatformFeeUpdated(newFeePercent);
    }
    
    function setPlatformFeeRecipient(address recipient) external onlyAdmin {
        if (recipient == address(0)) revert InvalidAddr();
        platformFeeRecipient = recipient;
    }
    
    function setKFactor(uint256 newKFactor) external onlyAdmin {
        if (newKFactor == 0 || newKFactor > 1000) revert InvalidK();
        kFactor = newKFactor;
        emit KFactorUpdated(newKFactor);
    }
    
    function setSupportedToken(address token, bool supported, string calldata tokenName) external onlyAdmin {
        bool wasSupported = supportedTokens[token];
        supportedTokens[token] = supported;
        
        // Store token name when adding
        if (supported) {
            if (bytes(tokenName).length > 0) {
                tokenNames[token] = tokenName;
            }
        }
        
        // Maintain list of supported tokens
        if (supported && !wasSupported) {
            // Add to list if not already there
            uint256 len = supportedTokensList.length;
            bool exists = false;
            for (uint256 i = 0; i < len; ) {
                if (supportedTokensList[i] == token) {
                    exists = true;
                    break;
                }
                unchecked { ++i; }
            }
            if (!exists) {
                supportedTokensList.push(token);
            }
        } else if (!supported && wasSupported) {
            // Remove from list
            uint256 len = supportedTokensList.length;
            for (uint256 i = 0; i < len; ) {
                if (supportedTokensList[i] == token) {
                    supportedTokensList[i] = supportedTokensList[len - 1];
                    supportedTokensList.pop();
                    break;
                }
                unchecked { ++i; }
            }
        }
        
        emit TokenSupported(token, supported);
    }
    
    // ============ PLAYER REGISTRATION ============
    
    function registerPlayer(string calldata username) external {
        if (bytes(username).length == 0 || bytes(username).length > 32) revert InvalidUser();
        if (usernameToAddress[username] != address(0)) revert UsernameTaken();
        if (players[msg.sender].registered) revert InvalidUser();
        
        players[msg.sender] = Player({
            username: username,
            wins: 0,
            losses: 0,
            draws: 0,
            totalGames: 0,
            rating: 100, // Starting rating
            registered: true
        });
        
        usernameToAddress[username] = msg.sender;
        emit PlayerRegistered(msg.sender, username);
    }
    
    function getPlayer(address player) external view returns (Player memory) {
        return players[player];
    }
    
    function getPlayerByUsername(string calldata username) external view returns (address, Player memory) {
        address playerAddr = usernameToAddress[username];
        return (playerAddr, players[playerAddr]);
    }
    
    // ============ GAME FUNCTIONS ============
    
    function createGame(
        uint256 betAmount,
        uint8 moveIndex,
        address tokenAddress,
        uint8 boardSize
    ) external payable nonReentrant whenNotPaused onlyRegistered {
        if (betAmount == 0) revert InvalidBet();
        if (boardSize != 3 && boardSize != 5 && boardSize != 7) revert InvalidSize();
        if (!supportedTokens[tokenAddress]) revert TokenNotSup();
        
        uint256 maxCells = uint256(boardSize) * uint256(boardSize);
        if (moveIndex >= maxCells) revert InvalidMove();
        
        // Handle payment
        if (tokenAddress == address(0)) {
            if (msg.value != betAmount) revert BetMismatch();
        } else {
            if (msg.value != 0) revert BetMismatch();
            IERC20(tokenAddress).transferFrom(msg.sender, address(this), betAmount);
        }
        
        uint256 gameId = gameIdCounter++;
        
        Game storage game = games[gameId];
        game.playerOne = msg.sender;
        game.betAmount = betAmount;
        game.tokenAddress = tokenAddress;
        game.boardSize = boardSize;
        game.isPlayerOneTurn = false;
        game.status = GameStatus.Active;
        game.lastMoveTimestamp = uint64(block.timestamp);
        gameBoards[gameId][moveIndex] = 1;
        
        emit GameCreated(gameId, msg.sender, betAmount, moveIndex, tokenAddress);
        emit MovePlayed(gameId, msg.sender, moveIndex);
    }
    
    function joinGame(
        uint256 gameId,
        uint8 moveIndex
    ) external payable nonReentrant validGame(gameId) gameActive(gameId) whenNotPaused onlyRegistered {
        Game storage game = games[gameId];
        
        if (game.playerTwo != address(0)) revert Started();
        if (msg.sender == game.playerOne) revert SelfPlay();
        uint256 maxCells = uint256(game.boardSize) * uint256(game.boardSize);
        if (moveIndex >= maxCells) revert InvalidMove();
        if (gameBoards[gameId][moveIndex] != 0) revert Occupied();
        
        // Handle payment
        if (game.tokenAddress == address(0)) {
            if (msg.value != game.betAmount) revert BetMismatch();
        } else {
            if (msg.value != 0) revert BetMismatch();
            IERC20(game.tokenAddress).transferFrom(msg.sender, address(this), game.betAmount);
        }
        
        game.playerTwo = msg.sender;
        gameBoards[gameId][moveIndex] = 2;
        game.isPlayerOneTurn = true;
        game.lastMoveTimestamp = uint64(block.timestamp);
        
        emit GameJoined(gameId, msg.sender, moveIndex);
        emit MovePlayed(gameId, msg.sender, moveIndex);
        
        _checkWinner(gameId);
    }
    
    function play(uint256 gameId, uint8 moveIndex) external nonReentrant validGame(gameId) gameActive(gameId) whenNotPaused {
        Game storage game = games[gameId];
        
        if (game.playerTwo == address(0)) revert NotActive();
        uint256 maxCells = uint256(game.boardSize) * uint256(game.boardSize);
        if (moveIndex >= maxCells) revert InvalidMove();
        if (gameBoards[gameId][moveIndex] != 0) revert Occupied();
        
        if (game.isPlayerOneTurn && msg.sender != game.playerOne) revert NotTurn();
        if (!game.isPlayerOneTurn && msg.sender != game.playerTwo) revert NotTurn();
        
        uint8 mark = game.isPlayerOneTurn ? 1 : 2;
        gameBoards[gameId][moveIndex] = mark;
        game.isPlayerOneTurn = !game.isPlayerOneTurn;
        game.lastMoveTimestamp = uint64(block.timestamp);
        
        emit MovePlayed(gameId, msg.sender, moveIndex);
        _checkWinner(gameId);
    }
    
    function forfeitGame(uint256 gameId) external nonReentrant validGame(gameId) gameActive(gameId) {
        Game storage game = games[gameId];
        
        if (game.playerTwo == address(0)) revert NotActive();
        if (block.timestamp <= uint256(game.lastMoveTimestamp) + moveTimeout) revert Timeout();
        
        // After timeout, the last player to move (the one whose turn it is NOT) wins
        // If it's playerOne's turn, playerTwo was the last to move, so playerTwo wins
        address winner = game.isPlayerOneTurn ? game.playerTwo : game.playerOne;
        
        game.status = GameStatus.Forfeited;
        game.winner = winner;
        
        // Store reward for manual claiming instead of auto-transferring
        uint256 payout = game.betAmount * 2;
        uint256 fee = (payout * platformFeePercent) / 10000;
        uint256 winnerPayout = payout - fee;
        
        claimableRewards[gameId] = winnerPayout;
        if (fee > 0) {
            _transferPayout(platformFeeRecipient, fee, game.tokenAddress);
        }
        
        _updatePlayerStats(game.playerOne, game.playerTwo, winner, false);
        _updateLeaderboard(winner);
        emit GameForfeited(gameId, winner);
    }
    
    function claimReward(uint256 gameId) external nonReentrant validGame(gameId) {
        Game storage game = games[gameId];
        
        // Ensure game is actually finished before allowing claim
        if (game.status != GameStatus.Ended && game.status != GameStatus.Forfeited) {
            revert NotFinished();
        }
        
        if (rewardClaimed[gameId]) revert Claimed();
        if (claimableRewards[gameId] == 0) revert NoReward();
        if (game.winner != msg.sender) revert NotWinner();
        
        uint256 amount = claimableRewards[gameId];
        rewardClaimed[gameId] = true;
        claimableRewards[gameId] = 0; // Clear to prevent reentrancy
        
        _transferPayout(msg.sender, amount, game.tokenAddress);
        emit RewardClaimed(gameId, msg.sender, amount);
    }
    
    // ============ CHALLENGE SYSTEM ============
    
    function createChallenge(
        address challenged,
        uint256 betAmount,
        address tokenAddress,
        uint8 boardSize
    ) external payable nonReentrant whenNotPaused onlyRegistered {
        if (challenged == msg.sender) revert SelfChallenge();
        if (challenged == address(0)) revert InvalidAddr();
        if (!players[challenged].registered) revert NotReg();
        if (betAmount == 0) revert InvalidBet();
        if (!supportedTokens[tokenAddress]) revert TokenNotSup();
        if (boardSize != 3 && boardSize != 5 && boardSize != 7) revert InvalidSize();
        
        // Handle payment
        if (tokenAddress == address(0)) {
            if (msg.value != betAmount) revert BetMismatch();
        } else {
            if (msg.value != 0) revert BetMismatch();
            IERC20(tokenAddress).transferFrom(msg.sender, address(this), betAmount);
        }
        
        uint256 challengeId = challengeCounter++;
        
        challenges[challengeId] = Challenge({
            challenger: msg.sender,
            challengerUsername: players[msg.sender].username,
            challenged: challenged,
            challengedUsername: players[challenged].username,
            betAmount: betAmount,
            tokenAddress: tokenAddress,
            boardSize: boardSize,
            timestamp: block.timestamp,
            accepted: false,
            gameId: 0
        });
        
        playerChallenges[msg.sender].push(challengeId);
        playerChallenges[challenged].push(challengeId);
        
        emit ChallengeCreated(challengeId, msg.sender, challenged, betAmount);
    }
    
    function acceptChallenge(uint256 challengeId, uint8 moveIndex) external payable nonReentrant whenNotPaused onlyRegistered {
        Challenge storage challenge = challenges[challengeId];
        
        if (challenge.challenged != msg.sender) revert Unauthorized();
        if (challenge.accepted) revert Accepted();
        uint256 maxCells = uint256(challenge.boardSize) * uint256(challenge.boardSize);
        if (moveIndex >= maxCells) revert InvalidMove();
        
        // Handle payment
        if (challenge.tokenAddress == address(0)) {
            if (msg.value != challenge.betAmount) revert BetMismatch();
        } else {
            if (msg.value > 0) revert BetMismatch();
            IERC20(challenge.tokenAddress).transferFrom(msg.sender, address(this), challenge.betAmount);
        }
        
        challenge.accepted = true;
        
        // Create game from challenge
        uint256 gameId = gameIdCounter++;
        Game storage game = games[gameId];
        game.playerOne = challenge.challenger;
        game.playerTwo = msg.sender;
        game.betAmount = challenge.betAmount;
        game.tokenAddress = challenge.tokenAddress;
        game.boardSize = challenge.boardSize;
        game.isPlayerOneTurn = false;
        game.status = GameStatus.Active;
        game.lastMoveTimestamp = uint64(block.timestamp);
        gameBoards[gameId][moveIndex] = 1; // Challenger's first move
        
        challenge.gameId = gameId;
        
        emit GameCreated(gameId, challenge.challenger, challenge.betAmount, moveIndex, challenge.tokenAddress);
        emit MovePlayed(gameId, challenge.challenger, moveIndex);
        emit ChallengeAccepted(challengeId, gameId);
        
        _checkWinner(gameId);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getTimeRemaining(uint256 gameId) external view validGame(gameId) returns (uint256) {
        Game storage game = games[gameId];
        if (game.lastMoveTimestamp == 0 || game.status != GameStatus.Active) return 0;
        uint256 deadline = uint256(game.lastMoveTimestamp) + moveTimeout;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }
    
    function getGame(uint256 gameId) external view validGame(gameId) returns (Game memory) {
        return games[gameId];
    }
    
    function getLatestGameId() external view returns (uint256) {
        return gameIdCounter;
    }
    
    function getLeaderboard(uint256 limit) external view returns (LeaderboardEntry[] memory) {
        uint256 length = leaderboard.length < limit ? leaderboard.length : limit;
        LeaderboardEntry[] memory result = new LeaderboardEntry[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = leaderboard[i];
        }
        return result;
    }
    
    function getPlayerChallenges(address player) external view returns (uint256[] memory) {
        return playerChallenges[player];
    }
    
    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }
    
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokensList;
    }
    
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }
    
    function getTokenName(address token) external view returns (string memory) {
        return tokenNames[token];
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _checkWinner(uint256 gameId) internal {
        Game storage game = games[gameId];
        uint8 boardSize = game.boardSize;
        uint256 totalCells = uint256(boardSize) * uint256(boardSize);
        mapping(uint256 => uint8) storage board = gameBoards[gameId];
        
        // Check rows
        for (uint256 row = 0; row < boardSize; ) {
            for (uint256 col = 0; col <= boardSize - 3; ) {
                uint256 base = row * boardSize + col;
                uint8 a = board[base];
                if (a != 0 && a == board[base + 1] && a == board[base + 2]) {
                    _declareWinner(gameId, a == 1 ? game.playerOne : game.playerTwo);
                    return;
                }
                unchecked { ++col; }
            }
            unchecked { ++row; }
        }
        
        // Check columns
        for (uint256 col = 0; col < boardSize; ) {
            for (uint256 row = 0; row <= boardSize - 3; ) {
                uint256 idx1 = row * boardSize + col;
                uint8 a = board[idx1];
                if (a != 0 && a == board[idx1 + boardSize] && a == board[idx1 + 2 * boardSize]) {
                    _declareWinner(gameId, a == 1 ? game.playerOne : game.playerTwo);
                    return;
                }
                unchecked { ++row; }
            }
            unchecked { ++col; }
        }
        
        // Check main diagonals
        for (uint256 row = 0; row <= boardSize - 3; ) {
            for (uint256 col = 0; col <= boardSize - 3; ) {
                uint256 idx1 = row * boardSize + col;
                uint8 a = board[idx1];
                uint256 idx2 = idx1 + boardSize + 1;
                uint256 idx3 = idx2 + boardSize + 1;
                if (a != 0 && a == board[idx2] && a == board[idx3]) {
                    _declareWinner(gameId, a == 1 ? game.playerOne : game.playerTwo);
                    return;
                }
                unchecked { ++col; }
            }
            unchecked { ++row; }
        }
        
        // Check anti-diagonals
        for (uint256 row = 0; row <= boardSize - 3; ) {
            for (uint256 col = 2; col < boardSize; ) {
                uint256 idx1 = row * boardSize + col;
                uint8 a = board[idx1];
                uint256 idx2 = idx1 + boardSize - 1;
                uint256 idx3 = idx2 + boardSize - 1;
                if (a != 0 && a == board[idx2] && a == board[idx3]) {
                    _declareWinner(gameId, a == 1 ? game.playerOne : game.playerTwo);
                return;
                }
                unchecked { ++col; }
            }
            unchecked { ++row; }
        }
        
        // Check for draw
        for (uint256 i = 0; i < totalCells; ) {
            if (board[i] == 0) {
                return; // Not a draw, game continues
            }
            unchecked { ++i; }
        }
        
        // Draw detected
            game.status = GameStatus.Ended;
            uint256 refund = game.betAmount;
            _transferPayout(game.playerOne, refund, game.tokenAddress);
            _transferPayout(game.playerTwo, refund, game.tokenAddress);
            _updatePlayerStats(game.playerOne, game.playerTwo, address(0), true);
        }
    
    function _declareWinner(uint256 gameId, address winner) internal {
        Game storage game = games[gameId];
        game.winner = winner;
        game.status = GameStatus.Ended;
        
        uint256 payout = game.betAmount * 2;
        uint256 fee = (payout * platformFeePercent) / 10000;
        uint256 winnerPayout = payout - fee;
        
        // Store reward for manual claiming instead of auto-transferring
        claimableRewards[gameId] = winnerPayout;
        if (fee > 0) {
            _transferPayout(platformFeeRecipient, fee, game.tokenAddress);
        }
        
        _updatePlayerStats(game.playerOne, game.playerTwo, winner, false);
        _updateLeaderboard(winner);
        
        emit GameWon(gameId, winner, winnerPayout);
    }
    
    function _transferPayout(address recipient, uint256 amount, address tokenAddress) internal {
        if (tokenAddress == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            if (!IERC20(tokenAddress).transfer(recipient, amount)) revert TransferFailed();
        }
    }
    
    function _updatePlayerStats(address player1, address player2, address winner, bool isDraw) internal {
        if (isDraw) {
            players[player1].draws++;
            players[player2].draws++;
            players[player1].totalGames++;
            players[player2].totalGames++;
        } else {
            address loser = winner == player1 ? player2 : player1;
            players[winner].wins++;
            players[loser].losses++;
            players[winner].totalGames++;
            players[loser].totalGames++;
            
            // Simple ELO rating update
            _updateRating(winner, loser);
        }
    }
    
    function _updateRating(address winner, address loser) internal {
        uint256 winnerRating = players[winner].rating;
        uint256 loserRating = players[loser].rating;
        
        // Simplified ELO: rating change based on difference
        uint256 diff = winnerRating > loserRating ? winnerRating - loserRating : loserRating - winnerRating;
        uint256 ratingChange = diff > kFactor ? kFactor : diff;
        
        if (winnerRating + ratingChange > winnerRating) {
            players[winner].rating = winnerRating + ratingChange;
        }
        if (loserRating > ratingChange) {
            players[loser].rating = loserRating - ratingChange;
        } else {
            players[loser].rating = 0;
        }
    }
    
    function _updateLeaderboard(address player) internal {
        Player memory playerData = players[player];
        uint256 len = leaderboard.length;
        bool found = false;
        uint256 insertIndex = len;
        
        // Find player or insertion point
        for (uint256 i = 0; i < len; ) {
            if (leaderboard[i].player == player) {
                leaderboard[i].rating = playerData.rating;
                leaderboard[i].wins = playerData.wins;
                found = true;
                // Only need to re-sort if rating changed significantly
                break;
            }
            if (!found && playerData.rating > leaderboard[i].rating) {
                insertIndex = i;
                break;
            }
            unchecked { ++i; }
        }
        
        if (!found && insertIndex < LEADERBOARD_SIZE) {
                // Insert at position
                leaderboard.push();
            for (uint256 i = len; i > insertIndex; ) {
                    leaderboard[i] = leaderboard[i - 1];
                unchecked { --i; }
                }
                leaderboard[insertIndex] = LeaderboardEntry({
                    player: player,
                    username: playerData.username,
                    rating: playerData.rating,
                    wins: playerData.wins
                });
                
                // Trim if exceeds size
                if (leaderboard.length > LEADERBOARD_SIZE) {
                    leaderboard.pop();
                }
        } else if (found) {
            // Simple re-sort only when needed (optimized)
            for (uint256 i = 0; i < len - 1; ) {
                if (leaderboard[i].rating < leaderboard[i + 1].rating) {
                    LeaderboardEntry memory temp = leaderboard[i];
                    leaderboard[i] = leaderboard[i + 1];
                    leaderboard[i + 1] = temp;
                    if (i > 0) { --i; } // Check previous
        } else {
                    unchecked { ++i; }
                }
            }
        }
    }
    
    // Owner functions
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ TEMPORARY TEST COUNTER ============
    // Temporary test counter for frontend testing
    uint256 private testCounter;
    
    /**
     * @notice Increment the test counter by 1
     * @dev Temporary function for testing purposes
     */
    function incrementCounter() external {
        testCounter++;
    }
    
    /**
     * @notice Decrement the test counter by 1
     * @dev Temporary function for testing purposes
     */
    function decrementCounter() external {
        testCounter--;
    }
    
    /**
     * @notice Get the current value of the test counter
     * @return The current counter value
     * @dev Temporary function for testing purposes
     */
    function getCounter() external view returns (uint256) {
        return testCounter;
    }
}