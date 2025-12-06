// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../BlOcXTacToe.sol";

/**
 * @title ReentrancyAttacker
 * @notice Malicious contract attempting to exploit reentrancy vulnerabilities
 */
contract ReentrancyAttacker {
    BlOcXTacToe public target;
    uint256 public gameId;
    bool public attacking;

    constructor(address _target) {
        target = BlOcXTacToe(_target);
    }

    function attackClaimReward(uint256 _gameId) external {
        gameId = _gameId;
        attacking = true;
        target.claimReward(_gameId);
    }

    function attackForfeitGame(uint256 _gameId) external {
        gameId = _gameId;
        attacking = true;
        target.forfeitGame(_gameId);
    }

    // Receive function to attempt reentrancy when receiving ETH
    receive() external payable {
        if (attacking) {
            attacking = false;
            // Try to re-enter claimReward
            try target.claimReward(gameId) {
                // If this succeeds, reentrancy protection failed
            } catch {
                // Reentrancy protection worked - expected to revert
            }
        }
    }
}

