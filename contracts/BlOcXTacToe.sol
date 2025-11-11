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
    
    // Admin Management
    mapping(address => bool) public admins;
    
    // Supported Tokens (address(0) = native ETH)
    mapping(address => bool) public supportedTokens;
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
    address[] public registeredPlayers;
    
    // Leaderboard (top players by rating)
    struct LeaderboardEntry {
        address player;
        string username;
        uint256 rating;
        uint256 wins;
    }
    
    LeaderboardEntry[] public leaderboard;
    uint256 public constant LEADERBOARD_SIZE = 100;
    
    // Latest Wins Feed
    struct WinRecord {
        uint256 gameId;
        address winner;
        string winnerUsername;
        address opponent;
        string opponentUsername;
        uint256 payout;
        uint256 timestamp;
    }
    
    WinRecord[] public latestWins;
    uint256 public constant MAX_WIN_RECORDS = 50;
    
    // Challenge System
    struct Challenge {
        address challenger;
        string challengerUsername;
        address challenged;
        string challengedUsername;
        uint256 betAmount;
        address tokenAddress; // address(0) for ETH
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
        uint8[9] board; // Packed: 0=empty, 1=X, 2=O
        bool isPlayerOneTurn;
        address winner;
        uint64 lastMoveTimestamp; // Packed timestamp
        GameStatus status;
    }
    
    enum GameStatus {
        Active,
        Ended,
        Forfeited
    }
    
    mapping(uint256 => Game) public games;
    uint256 private gameIdCounter;
    
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
    error CannotPlaySelf();
    error PayoutTransferFailed();
    error RefundTransferFailed();
    error InvalidPlayerAddress();
    error UsernameTaken();
    error UsernameInvalid();
    error NotRegistered();
    error NotAdmin();
    error InvalidTimeout();
    error InvalidFeePercent();
    error TokenNotSupported();
    error ChallengeNotFound();
    error ChallengeAlreadyAccepted();
    error CannotChallengeSelf();
    error InvalidChallenge();
    
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
    event TokenSupported(address indexed token, bool supported);
    event ChallengeCreated(uint256 indexed challengeId, address indexed challenger, address indexed challenged, uint256 betAmount);
    event ChallengeAccepted(uint256 indexed challengeId, uint256 indexed gameId);
    event LatestWinRecorded(uint256 indexed gameId, address indexed winner, string winnerUsername, address indexed opponent, string opponentUsername);
    
    // Modifiers
    modifier validGame(uint256 gameId) {
        if (gameId >= gameIdCounter) revert InvalidGameId();
        _;
    }
    
    modifier gameActive(uint256 gameId) {
        if (games[gameId].status != GameStatus.Active) revert GameNotActive();
        _;
    }
    
    modifier onlyAdmin() {
        if (!admins[msg.sender] && msg.sender != owner()) revert NotAdmin();
        _;
    }
    
    modifier onlyRegistered() {
        if (!players[msg.sender].registered) revert NotRegistered();
        _;
    }
    
    constructor() Ownable(msg.sender) {
        moveTimeout = 24 hours;
        platformFeePercent = 0; // No fee by default
        platformFeeRecipient = msg.sender;
        admins[msg.sender] = true;
        supportedTokens[address(0)] = true; // Native ETH supported by default
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
        if (newFeePercent > 1000) revert InvalidFeePercent(); // Max 10%
        platformFeePercent = newFeePercent;
        emit PlatformFeeUpdated(newFeePercent);
    }
    
    function setPlatformFeeRecipient(address recipient) external onlyAdmin {
        if (recipient == address(0)) revert InvalidPlayerAddress();
        platformFeeRecipient = recipient;
    }
    
    function setSupportedToken(address token, bool supported) external onlyAdmin {
        bool wasSupported = supportedTokens[token];
        supportedTokens[token] = supported;
        
        // Maintain list of supported tokens
        if (supported && !wasSupported) {
            // Add to list if not already there
            bool exists = false;
            for (uint256 i = 0; i < supportedTokensList.length; i++) {
                if (supportedTokensList[i] == token) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                supportedTokensList.push(token);
            }
        } else if (!supported && wasSupported) {
            // Remove from list
            for (uint256 i = 0; i < supportedTokensList.length; i++) {
                if (supportedTokensList[i] == token) {
                    supportedTokensList[i] = supportedTokensList[supportedTokensList.length - 1];
                    supportedTokensList.pop();
                    break;
                }
            }
        }
        
        emit TokenSupported(token, supported);
    }
    
    // ============ PLAYER REGISTRATION ============
    
    function registerPlayer(string calldata username) external {
        if (bytes(username).length == 0 || bytes(username).length > 32) revert UsernameInvalid();
        if (usernameToAddress[username] != address(0)) revert UsernameTaken();
        if (players[msg.sender].registered) revert UsernameInvalid(); // Already registered
        
        players[msg.sender] = Player({
            username: username,
            wins: 0,
            losses: 0,
            draws: 0,
            totalGames: 0,
            rating: 1000, // Starting rating
            registered: true
        });
        
        usernameToAddress[username] = msg.sender;
        registeredPlayers.push(msg.sender);
        
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
        address tokenAddress
    ) external payable nonReentrant whenNotPaused onlyRegistered {
        if (betAmount == 0) revert InvalidBetAmount();
        if (moveIndex > 8) revert InvalidMove();
        if (!supportedTokens[tokenAddress]) revert TokenNotSupported();
        
        // Handle payment
        if (tokenAddress == address(0)) {
            if (msg.value != betAmount) revert BetMismatch();
        } else {
            if (msg.value > 0) revert BetMismatch();
            IERC20(tokenAddress).transferFrom(msg.sender, address(this), betAmount);
        }
        
        uint256 gameId = gameIdCounter++;
        
        Game storage game = games[gameId];
        game.playerOne = msg.sender;
        game.betAmount = betAmount;
        game.tokenAddress = tokenAddress;
        game.isPlayerOneTurn = false;
        game.status = GameStatus.Active;
        game.lastMoveTimestamp = uint64(block.timestamp);
        game.board[moveIndex] = 1;
        
        emit GameCreated(gameId, msg.sender, betAmount, moveIndex, tokenAddress);
        emit MovePlayed(gameId, msg.sender, moveIndex);
    }
    
    function joinGame(
        uint256 gameId,
        uint8 moveIndex
    ) external payable nonReentrant validGame(gameId) gameActive(gameId) whenNotPaused onlyRegistered {
        Game storage game = games[gameId];
        
        if (game.playerTwo != address(0)) revert GameAlreadyStarted();
        if (msg.sender == game.playerOne) revert CannotPlaySelf();
        if (moveIndex > 8) revert InvalidMove();
        if (game.board[moveIndex] != 0) revert CellOccupied();
        
        // Handle payment
        if (game.tokenAddress == address(0)) {
            if (msg.value != game.betAmount) revert BetMismatch();
        } else {
            if (msg.value > 0) revert BetMismatch();
            IERC20(game.tokenAddress).transferFrom(msg.sender, address(this), game.betAmount);
        }
        
        game.playerTwo = msg.sender;
        game.board[moveIndex] = 2;
        game.isPlayerOneTurn = true;
        game.lastMoveTimestamp = uint64(block.timestamp);
        
        emit GameJoined(gameId, msg.sender, moveIndex);
        emit MovePlayed(gameId, msg.sender, moveIndex);
        
        _checkWinner(gameId);
    }
    
    function play(uint256 gameId, uint8 moveIndex) external nonReentrant validGame(gameId) gameActive(gameId) whenNotPaused {
        Game storage game = games[gameId];
        
        if (game.playerTwo == address(0)) revert GameNotActive();
        if (moveIndex > 8) revert InvalidMove();
        if (game.board[moveIndex] != 0) revert CellOccupied();
        
        if (game.isPlayerOneTurn && msg.sender != game.playerOne) revert NotYourTurn();
        if (!game.isPlayerOneTurn && msg.sender != game.playerTwo) revert NotYourTurn();
        
        uint8 mark = game.isPlayerOneTurn ? 1 : 2;
        game.board[moveIndex] = mark;
        game.isPlayerOneTurn = !game.isPlayerOneTurn;
        game.lastMoveTimestamp = uint64(block.timestamp);
        
        emit MovePlayed(gameId, msg.sender, moveIndex);
        _checkWinner(gameId);
    }
    
    function forfeitGame(uint256 gameId) external nonReentrant validGame(gameId) gameActive(gameId) {
        Game storage game = games[gameId];
        
        if (game.playerTwo == address(0)) revert GameNotActive();
        if (block.timestamp <= uint256(game.lastMoveTimestamp) + moveTimeout) revert TimeoutNotReached();
        
        address winner = game.isPlayerOneTurn ? game.playerTwo : game.playerOne;
        if (msg.sender != winner) revert UnauthorizedForfeit();
        
        game.status = GameStatus.Forfeited;
        game.winner = winner;
        
        uint256 payout = game.betAmount * 2;
        _transferPayout(winner, payout, game.tokenAddress);
        
        _updatePlayerStats(game.playerOne, game.playerTwo, winner, false);
        emit GameForfeited(gameId, winner);
    }
    
    // ============ CHALLENGE SYSTEM ============
    
    function createChallenge(
        address challenged,
        uint256 betAmount,
        address tokenAddress
    ) external payable nonReentrant whenNotPaused onlyRegistered {
        if (challenged == msg.sender) revert CannotChallengeSelf();
        if (challenged == address(0)) revert InvalidPlayerAddress();
        if (!players[challenged].registered) revert NotRegistered();
        if (betAmount == 0) revert InvalidBetAmount();
        if (!supportedTokens[tokenAddress]) revert TokenNotSupported();
        
        // Handle payment
        if (tokenAddress == address(0)) {
            if (msg.value != betAmount) revert BetMismatch();
        } else {
            if (msg.value > 0) revert BetMismatch();
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
        
        if (challenge.challenged != msg.sender) revert UnauthorizedForfeit();
        if (challenge.accepted) revert ChallengeAlreadyAccepted();
        if (moveIndex > 8) revert InvalidMove();
        
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
        game.isPlayerOneTurn = false;
        game.status = GameStatus.Active;
        game.lastMoveTimestamp = uint64(block.timestamp);
        game.board[moveIndex] = 1; // Challenger's first move
        
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
    
    function getLatestWins(uint256 limit) external view returns (WinRecord[] memory) {
        uint256 length = latestWins.length < limit ? latestWins.length : limit;
        WinRecord[] memory result = new WinRecord[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = latestWins[i];
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
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _checkWinner(uint256 gameId) internal {
        Game storage game = games[gameId];
        uint8[9] memory board = game.board;
        
        // Optimized winner detection - check all 8 winning combinations
        uint8[3][8] memory combos = [
            [uint8(0), uint8(1), uint8(2)], [uint8(3), uint8(4), uint8(5)],
            [uint8(6), uint8(7), uint8(8)], [uint8(0), uint8(3), uint8(6)],
            [uint8(1), uint8(4), uint8(7)], [uint8(2), uint8(5), uint8(8)],
            [uint8(0), uint8(4), uint8(8)], [uint8(2), uint8(4), uint8(6)]
        ];
        
        for (uint256 i = 0; i < 8; i++) {
            uint8 a = board[combos[i][0]];
            uint8 b = board[combos[i][1]];
            uint8 c = board[combos[i][2]];
            
            if (a != 0 && a == b && b == c) {
                address winner = a == 1 ? game.playerOne : game.playerTwo;
                game.winner = winner;
                game.status = GameStatus.Ended;
                
                uint256 payout = game.betAmount * 2;
                uint256 fee = (payout * platformFeePercent) / 10000;
                uint256 winnerPayout = payout - fee;
                
                _transferPayout(winner, winnerPayout, game.tokenAddress);
                if (fee > 0) {
                    _transferPayout(platformFeeRecipient, fee, game.tokenAddress);
                }
                
                _updatePlayerStats(game.playerOne, game.playerTwo, winner, false);
                _addWinRecord(gameId, winner, game.playerOne == winner ? game.playerTwo : game.playerOne);
                _updateLeaderboard(winner);
                
                emit GameWon(gameId, winner, winnerPayout);
                return;
            }
        }
        
        // Check for draw
        bool isDraw = true;
        for (uint256 i = 0; i < 9; i++) {
            if (board[i] == 0) {
                isDraw = false;
                break;
            }
        }
        
        if (isDraw) {
            game.status = GameStatus.Ended;
            uint256 refund = game.betAmount;
            _transferPayout(game.playerOne, refund, game.tokenAddress);
            _transferPayout(game.playerTwo, refund, game.tokenAddress);
            _updatePlayerStats(game.playerOne, game.playerTwo, address(0), true);
        }
    }
    
    function _transferPayout(address recipient, uint256 amount, address tokenAddress) internal {
        if (tokenAddress == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert PayoutTransferFailed();
        } else {
            bool success = IERC20(tokenAddress).transfer(recipient, amount);
            if (!success) revert PayoutTransferFailed();
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
        
        // ELO calculation (simplified)
        uint256 expectedWinner = (1000 * (10 ** 18)) / (1000 * (10 ** 18) + (1000 + loserRating - winnerRating) * (10 ** 18) / 1000);
        uint256 kFactor = 32;
        uint256 ratingChange = (kFactor * (10 ** 18 - expectedWinner)) / (10 ** 18);
        
        if (winnerRating + ratingChange > winnerRating) {
            players[winner].rating = winnerRating + ratingChange;
        }
        if (loserRating > ratingChange) {
            players[loser].rating = loserRating - ratingChange;
        } else {
            players[loser].rating = 0;
        }
    }
    
    function _addWinRecord(uint256 gameId, address winner, address opponent) internal {
        if (latestWins.length >= MAX_WIN_RECORDS) {
            // Remove oldest
            for (uint256 i = 0; i < latestWins.length - 1; i++) {
                latestWins[i] = latestWins[i + 1];
            }
            latestWins.pop();
        }
        
        latestWins.push(WinRecord({
            gameId: gameId,
            winner: winner,
            winnerUsername: players[winner].username,
            opponent: opponent,
            opponentUsername: players[opponent].username,
            payout: games[gameId].betAmount * 2,
            timestamp: block.timestamp
        }));
        
        emit LatestWinRecorded(gameId, winner, players[winner].username, opponent, players[opponent].username);
    }
    
    function _updateLeaderboard(address player) internal {
        Player memory playerData = players[player];
        
        // Find if player is already in leaderboard
        uint256 insertIndex = leaderboard.length;
        bool found = false;
        
        for (uint256 i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].player == player) {
                leaderboard[i].rating = playerData.rating;
                leaderboard[i].wins = playerData.wins;
                found = true;
                break;
            }
            if (!found && playerData.rating > leaderboard[i].rating) {
                insertIndex = i;
                break;
            }
        }
        
        if (!found) {
            if (insertIndex < LEADERBOARD_SIZE) {
                // Insert at position
                leaderboard.push();
                for (uint256 i = leaderboard.length - 1; i > insertIndex; i--) {
                    leaderboard[i] = leaderboard[i - 1];
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
            }
        } else {
            // Re-sort leaderboard
            for (uint256 i = 0; i < leaderboard.length - 1; i++) {
                for (uint256 j = 0; j < leaderboard.length - i - 1; j++) {
                    if (leaderboard[j].rating < leaderboard[j + 1].rating) {
                        LeaderboardEntry memory temp = leaderboard[j];
                        leaderboard[j] = leaderboard[j + 1];
                        leaderboard[j + 1] = temp;
                    }
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
}
