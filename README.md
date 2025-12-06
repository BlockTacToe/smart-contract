# BlockTacToe 🎮 – Smart Contracts

A fully decentralized, peer-to-peer Tic Tac Toe game built on Ethereum with ETH betting functionality. Players can create games, join existing games, and compete for ETH rewards in a trustless, onchain environment.

## ✨ Features

- **🎯 PvP Gameplay:** Play against other players in real-time
- **💰 ETH Betting:** Bet ETH tokens on game outcomes
- **🏆 Winner Takes All:** Winner receives both players' bet amounts
- **🔒 Trustless:** All game logic and funds managed by smart contract
- **⚡ Fast Transactions:** Leverages Ethereum's fast block times
- **⏰ Timeout Protection:** Anti-griefing mechanism with forfeit system
- **🏆 Social Competition:** Winner celebration and challenge sharing system

Create/join/play flows for PvP Tic Tac Toe:

- Bets escrowed in contract; winner takes all
- Turn enforcement and move validation
- Automatic winner detection (3-in-a-row)
- Timeout/forfeit mechanism (anti-griefing)
- Read-only getters for UI rendering
- Events for off-chain indexing and realtime UI

## 🧰 Tech & Tooling

- **Language:** Solidity ^0.8.x
- **Framework:** Hardhat
- **Network:** Base Sepolia Testnet
- **Dependencies:** OpenZeppelin (ReentrancyGuard, helpers)

**Key Features:**

- Game creation with custom bet amounts
- Turn-based move validation
- Automatic winner detection
- ETH token transfers
- Multiple concurrent games support
- Timeout/forfeit mechanism
- Winner celebration and social sharing

## 🎯 Game Rules

1. **Board:** 3x3 grid with positions 0-8
2. **Moves:** Player 1 uses X (value 1), Player 2 uses O (value 2)
3. **Winning:** Three in a row (horizontal, vertical, or diagonal)
4. **Betting:** Both players must bet equal amounts
5. **Reward:** Winner receives both players' ETH
6. **Timeout:** 24-hour timeout per move, forfeit available after timeout

## 📁 Project Structure

```
smart-contracts/
├── contracts/
│   └── TicTacToe.sol
├── scripts/
│   ├── deploy.ts
│   └── verify.ts
├── test/
│   ├── TicTacToe.core.spec.ts
│   ├── TicTacToe.timeout.spec.ts
│   └── TicTacToe.security.spec.ts
└── hardhat.config.ts
```

## 🔧 Smart Contract Functions

### Public Functions

- `createGame(uint256 betAmount, uint8 moveIndex)` - Create new game with first move
- `joinGame(uint256 gameId, uint8 moveIndex)` - Join existing game
- `play(uint256 gameId, uint8 moveIndex)` - Make a move in ongoing game
- `forfeitGame(uint256 gameId)` - Forfeit game due to timeout

### Read-Only Functions

- `getGame(uint256 gameId)` - Get game details
- `getLatestGameId()` - Get total number of games created
- `getTimeRemaining(uint256 gameId)` - Get time remaining for current move

### Suggested Game Struct

```solidity
struct Game {
    address playerOne;
    address playerTwo;      // address(0) until joined
    uint256 betAmount;      // in wei
    uint8[9] board;         // 0=empty, 1=X, 2=O
    bool isPlayerOneTurn;   // true=>X turn
    address winner;         // address(0) until decided
    uint256 lastMoveTs;     // unix timestamp of last move
    // optional: status enum (Active, Ended, Forfeited)
}
```

## ⏰ Timeout / Forfeit Mechanism

- `lastMoveTs` updated on each valid move
- Constant threshold (e.g., 24h) enforced
- If opponent exceeds threshold, current player can call `forfeitGame` to end and withdraw
- Emits `GameForfeited(gameId, winner)` event

## 🔒 Security Features

- **Input Validation:** All moves validated for bounds and availability
- **Turn Enforcement:** Players can only move on their turn
- **Fund Security:** ETH locked in contract until game completion
- **Winner Verification:** Automatic winner detection prevents disputes
- **Timeout Protection:** Anti-griefing with forfeit mechanism
- **Reentrancy Protection:** Secure against reentrancy attacks

**Security Considerations:**

- Reentrancy protection on state-changing functions that transfer ETH
- Checks-Effects-Interactions pattern
- Input validation (bounds, empty cell, correct turn/move)
- Use of custom errors for gas-efficient revert reasons
- Pull over push for payouts (if adopting claim pattern)

## 📡 Events (for Indexers/UI)

- `GameCreated(gameId, playerOne, betAmount, moveIndex)`
- `GameJoined(gameId, playerTwo, moveIndex)`
- `MovePlayed(gameId, by, moveIndex)`
- `GameWon(gameId, winner, payout)`
- `GameForfeited(gameId, winner)`

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- Hardhat
- Ethereum wallet for testing

### Smart Contract Development

```bash
# Navigate to contract directory
cd smart-contracts

# Install dependencies
npm install

# Run tests
npm test

# Deploy to testnet
npm run deploy:sepolia
```

## 📏 Contract Size Analysis

✅ **Hardhat Contract Size Command**

Hardhat doesn't check contract size with compile. You need the `hardhat-contract-sizer` plugin.

### 1️⃣ Install Plugin (if you haven't):

```bash
npm install --save-dev hardhat-contract-sizer
```

### 2️⃣ Add to `hardhat.config.ts`:

```typescript
require("hardhat-contract-sizer");

// In your HardhatUserConfig:
contractSizer: {
  alphaSort: true,
  runOnCompile: true,
  disambiguatePaths: false,
},
```

### 3️⃣ Check Contract Size:

```bash
npx hardhat size-contracts
```

### 📌 Alternative (runs automatically on compile):

If `runOnCompile: true` is enabled, then just:

```bash
npx hardhat compile
```

It will print contract sizes after compiling automatically.

## 🌐 Network Configuration

### Base Sepolia Testnet

- **RPC URL:** `https://sepolia.infura.io/v3/YOUR_PROJECT_ID` (or Base RPC)
- **Chain ID:** `11155111` (or Base Sepolia chain ID)
- **Contract:** `TBD` (To be deployed)

## 📦 Deployments

- **Sepolia (testnet):** `0x5c6a9F3511773bc0DBf6354623104f01Ac8EE629` (deployed 2025-11-15)
- **Base (mainnet):** `0x52e3C6FF91c51493E08434E806bD54Bd5c7a2151` (deployed 2025-11-22, verified)

> Note: The Sepolia address is kept for testing/reference. The Base address is the live mainnet deployment. Keep both entries for clarity when testing or updating the frontend.

### Example .env

```
PRIVATE_KEY=0x...
RPC_URL=https://sepolia.infura.io/v3/<YOUR_PROJECT_ID>
ETHERSCAN_API_KEY=<YOUR_KEY>
```

## 🚀 Deployment

### Deploy to Base Sepolia

```bash
cd smart-contracts
npm run deploy:sepolia
```

### Deploy to Mainnet

```bash
cd smart-contracts
npm run deploy:mainnet
```

### Deploy with Verification

```bash
# Configure .env with PRIVATE_KEY, RPC_URL, ETHERSCAN_API_KEY
npm run deploy:sepolia
npm run verify:sepolia
```

## 🧪 Testing

The smart contract includes **comprehensive test coverage** with **191+ passing tests** across **6 test files**, achieving **~98%+ coverage** of all contract functionality.

### 📊 Test Coverage Overview

| Category | Coverage | Test File |
|----------|----------|-----------|
| Core Functionality | ✅ 100% | `BlOcXTacToe.test.ts` (76 tests) |
| Admin Functions & Edge Cases | ✅ 100% | `BlOcXTacToeT2.test.ts` (64 tests) |
| Challenge System & Leaderboard | ✅ 100% | `BlOcXTacToeT3.test.ts` (41 tests) |
| Rating, Stats & Security | ✅ 100% | `BlOcXTacToeT4.test.ts` (26 tests) |
| Payment, Fees & Counter | ✅ 100% | `BlOcXTacToeT5.test.ts` (35 tests) |
| Edge Cases & Boundaries | ✅ 100% | `BlOcXTacToeEdgeCase.test.ts` (17 tests) |

### ✅ Test Coverage by Category

#### 1. **Core Functionality** (100%)
- ✅ Game creation and joining
- ✅ Turn-based gameplay
- ✅ Move validation (bounds, occupied spots)
- ✅ Winner detection for both players
- ✅ Error handling for invalid operations
- ✅ Timeout and forfeit mechanisms
- ✅ Player registration and management

#### 2. **Admin Functions** (100%)
- ✅ Admin management (add/remove)
- ✅ Move timeout configuration (1s to 7 days)
- ✅ Platform fee settings (0% to 10%)
- ✅ K-factor configuration for rating system
- ✅ Token management (add/remove supported tokens)
- ✅ Pause/unpause functionality

#### 3. **Game Mechanics** (100%)
- ✅ Board sizes: 3x3, 5x5, 7x7
- ✅ Win patterns: Horizontal, Vertical, Diagonal (main & anti)
- ✅ Draw game detection and handling
- ✅ Player 1 (X) and Player 2 (O) winning scenarios
- ✅ Multiple simultaneous win detection (first detected wins)
- ✅ Invalid board sizes and move validation

#### 4. **Challenge System** (100%)
- ✅ Challenge creation (ETH and ERC20)
- ✅ Challenge acceptance
- ✅ Multiple challenges between same players
- ✅ Challenge with different board sizes
- ✅ Player challenge retrieval

#### 5. **Leaderboard System** (100%)
- ✅ Top players by rating
- ✅ Leaderboard size limit (100 players)
- ✅ Rating-based sorting
- ✅ Same rating handling
- ✅ Leaderboard updates on wins

#### 6. **Rating System** (100%)
- ✅ ELO-style rating calculations
- ✅ Rating updates on wins/losses
- ✅ Rating at 0 (minimum)
- ✅ Rating at very high values
- ✅ Different K-factor values
- ✅ Rating when both players have same rating

#### 7. **Player Stats** (100%)
- ✅ Win/loss/draw tracking
- ✅ Total games counter
- ✅ Stats updates on multiple games
- ✅ Draw game stats (no rating change)

#### 8. **Payment Handling** (100%)
- ✅ ETH transfers
- ✅ ERC20 token transfers
- ✅ Token approval requirements
- ✅ Insufficient balance/allowance handling
- ✅ Contract balance verification

#### 9. **Platform Fee** (100%)
- ✅ Fee calculation on win
- ✅ Fee calculation on forfeit
- ✅ Zero fee scenarios
- ✅ Maximum fee (10%) scenarios
- ✅ Fee recipient receives correct amount
- ✅ Fee doesn't affect winner payout

#### 10. **Security & Protection** (100%)
- ✅ Reentrancy protection (claimReward, forfeitGame, createGame)
- ✅ Pausable functionality (all game functions)
- ✅ Access control (admin functions)
- ✅ Input validation (all functions)
- ✅ State management (game status)

#### 11. **Edge Cases & Boundaries** (100%)
- ✅ Timeout edge cases (exactly at deadline, 1s before/after, min/max)
- ✅ Draw game refunds (no platform fee)
- ✅ Token edge cases (empty names, very long names, updates)
- ✅ Leaderboard edge cases (same ratings, capacity limits)
- ✅ Challenge edge cases (multiple challenges, different parameters)

### 🧪 Running Tests

**Run all tests:**
```bash
cd blocxtactoe-smartcontract
npm test
```

**Run specific test file:**
```bash
# Core functionality
npx hardhat test test/BlOcXTacToe.test.ts --network hardhat

# Admin functions and edge cases
npx hardhat test test/BlOcXTacToeT2.test.ts --network hardhat

# Challenge system and leaderboard
npx hardhat test test/BlOcXTacToeT3.test.ts --network hardhat

# Rating, stats, and security
npx hardhat test test/BlOcXTacToeT4.test.ts --network hardhat

# Payment, fees, and counter
npx hardhat test test/BlOcXTacToeT5.test.ts --network hardhat

# Edge cases and boundaries
npx hardhat test test/BlOcXTacToeEdgeCase.test.ts --network hardhat
```

**Run tests with coverage report:**
```bash
npm test -- --coverage
```

### 📈 Test Statistics

- **Total Test Files:** 6
- **Total Tests:** 191+ passing
- **Test Coverage:** ~98%+
- **Functions Tested:** 32/32 (100%)
- **Edge Cases Covered:** 25+ scenarios
- **Security Tests:** Reentrancy, access control, input validation

### 🔍 Test Details

**Core Flow Testing:**
- ✅ Create → Join → Play → Win (X and O)
- ✅ Create → Join → Play → Draw
- ✅ Create → Join → Timeout → Forfeit

**Validation Testing:**
- ✅ Out-of-bounds moves
- ✅ Occupied cell moves
- ✅ Wrong turn moves
- ✅ Invalid game IDs
- ✅ Unregistered players

**Security Testing:**
- ✅ Reentrancy attacks (3 attack vectors)
- ✅ Access control violations
- ✅ Invalid input handling
- ✅ State manipulation attempts

**Edge Case Testing:**
- ✅ Timeout boundaries (exact, 1s before/after, min/max)
- ✅ Rating boundaries (0, very high values)
- ✅ Leaderboard capacity (100 players, 101st player)
- ✅ Token name boundaries (empty, very long)
- ✅ Multiple simultaneous wins

For detailed test coverage analysis, see [`TEST_COVERAGE_ANALYSIS.md`](../TEST_COVERAGE_ANALYSIS.md).

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Development Guidelines

- Follow Solidity style guide
- Write comprehensive tests
- Update documentation
- Follow conventional commit messages
- Ensure all tests pass

### Reporting Issues

- Use the GitHub issue tracker
- Provide detailed reproduction steps
- Include environment information
- Add screenshots if applicable

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built on the [Ethereum blockchain](https://ethereum.org/)
- Uses [Hardhat](https://hardhat.org/) for smart contract development
- Wallet integration via [MetaMask](https://metamask.io/)

## 🐛 Known Issues & Roadmap

### 🔥 High Priority Issues

#### Smart Contract Issues

- [x] **Issue #1:** Core Smart Contract Implementation ✅

  - [x] Create `TicTacToe.sol` with basic game structure
  - [x] Implement `createGame(uint256 betAmount, uint8 moveIndex)` function
  - [x] Implement `joinGame(uint256 gameId, uint8 moveIndex)` function
  - [x] Implement `play(uint256 gameId, uint8 moveIndex)` function
  - [x] Add game data struct with player addresses, bet amount, board state
  - [x] Implement winner detection logic (3-in-a-row validation)
  - [x] Add move validation (bounds checking, empty cell validation)
  - [x] Implement ETH transfer logic for betting and payouts
  - [x] Add event emissions for game state changes
  - [x] Create read-only functions `getGame()` and `getLatestGameId()`

- [x] **Issue #2:** Timeout/Forfeit Mechanism Implementation ✅

  - [x] Add `lastMoveTimestamp` field to game struct
  - [x] Implement 24-hour timeout constant and validation
  - [x] Create `forfeitGame(uint256 gameId)` function
  - [x] Add timeout checking logic in existing functions
  - [x] Implement automatic forfeit detection
  - [x] Add events for timeout and forfeit actions
  - [x] Create `getTimeRemaining(uint256 gameId)` view function
  - [x] Add modifier for timeout validation

- [x] **Issue #3:** Security & Error Handling ✅
  - [x] Implement reentrancy protection using OpenZeppelin's ReentrancyGuard
  - [x] Add comprehensive error messages with custom errors
  - [x] Implement access control for game operations
  - [x] Add input validation for all public functions
  - [x] Implement proper state management (game status enum)
  - [x] Add overflow protection for arithmetic operations (Solidity 0.8+ built-in)
  - [x] Create emergency pause functionality (if needed) - Pausable contract included

### 🔶 Medium Priority Issues

#### Smart Contract Issues

- [ ] **Issue #8:** Gas Optimization & Efficiency

  - [ ] Optimize storage layout to reduce gas costs
  - [ ] Implement batch operations where possible
  - [ ] Use packed structs to reduce storage slots
  - [ ] Optimize loop operations and array access
  - [ ] Implement efficient winner detection algorithm
  - [ ] Add gas estimation functions
  - [ ] Create gas-efficient deployment scripts
  - [ ] Implement upgradeable contract pattern (if needed)

- [ ] **Issue #9:** Advanced Contract Features
  - [ ] Add game statistics tracking (wins, losses, total games)
  - [ ] Implement player rating system
  - [ ] Create game history and replay functionality
  - [ ] Add tournament mode support
  - [ ] Implement spectator mode for ongoing games
  - [ ] Add game creation fees and platform revenue
  - [ ] Create referral system for new players
  - [ ] Implement multi-token support (ERC20 tokens)

### 🔵 Low Priority Issues

#### Smart Contract Issues

- [ ] **Issue #12:** Advanced Game Mechanics

  - [ ] Implement different game modes (timed, untimed, custom rules)
  - [ ] Add game difficulty levels
  - [ ] Create custom board sizes (4x4, 5x5)
  - [ ] Implement power-ups and special moves
  - [ ] Add team-based gameplay
  - [ ] Create seasonal events and limited-time modes
  - [ ] Implement game replay and analysis
  - [ ] Add AI opponent integration

- [ ] **Issue #13:** Governance & Decentralization
  - [ ] Implement DAO governance for game parameters
  - [ ] Create voting system for rule changes
  - [ ] Add community-driven feature requests
  - [ ] Implement decentralized dispute resolution
  - [ ] Create token-based governance system
  - [ ] Add community moderation tools
  - [ ] Implement reputation system for players
  - [ ] Create decentralized tournament management
