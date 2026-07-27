// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IMintableERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TokenFaucet
/// @notice mỗi token có claim và coldown riêng, dùng local/testnet 
contract TokenFaucet is AccessControl, Pausable, ReentrancyGuard{
    mapping(address token => bool supported) public supportedTokens;
    mapping(address token => uint256 amount) public claimAmounts;
    mapping(address token => uint256 cooldown) public claimCooldowns;
    mapping(address token => mapping(address user => uint256 claimAt)) public lastClaimAt;

    error UnsupportedToken(address token);
    error InvalidClaimAmount();
    error FaucetCooldownActive(uint256 nextClaimAt);

    event TokenClaimed(address indexed user, address indexed token, uint256 amount);
    event TokenConfigured(address indexed token, bool supported, uint256 amount, uint256 cooldown);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function claim(address token) external whenNotPaused nonReentrant {
        if(!supportedTokens[token]) revert UnsupportedToken(token);
        if(claimAmounts[token] == 0) revert InvalidClaimAmount();
        uint256 nextClaimAt = lastClaimAt[token][msg.sender] + claimCooldowns[token];
        if(block.timestamp < nextClaimAt) revert FaucetCooldownActive(nextClaimAt);
        lastClaimAt[token][msg.sender] = block.timestamp;
        IMintableERC20(token).mint(msg.sender, claimAmounts[token]);
        emit TokenClaimed(msg.sender, token, claimAmounts[token]);
    }

    // admin functions
    function setTokenConfig(address token, bool supported, uint256 amount, uint256 cooldown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
        claimAmounts[token] = amount;
        claimCooldowns[token] = cooldown;
        emit TokenConfigured(token, supported, amount, cooldown);
    }

    function setSupportedToken(address token, bool supported) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
        emit TokenConfigured(token, supported, claimAmounts[token], claimCooldowns[token]);
    }

    function setClaimAmount(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        claimAmounts[token] = amount;
        emit TokenConfigured(token, supportedTokens[token], amount, claimCooldowns[token]);
    }

    function setClaimCooldown(address token, uint256 cooldown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        claimCooldowns[token] = cooldown;
        emit TokenConfigured(token, supportedTokens[token], claimAmounts[token], cooldown);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}