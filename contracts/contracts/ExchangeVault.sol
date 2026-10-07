// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ExchangeVault — Nhận ERC-20 token từ User và phát event để Backend credit Wallet nội bộ.
/// @notice accountReference là bytes32 do Backend cung cấp qua Deposit Intent API.
///         Mỗi cặp (accountReference, msg.sender) chỉ được dùng MỘT LẦN DUY NHẤT.
///         Nạp lần 2: tạo Deposit Intent mới để nhận accountReference mới.
contract ExchangeVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────────
    /// @notice Token được phép Deposit
    mapping(address token => bool supported) public supportedTokens;

    /// @notice depositKey = keccak256(abi.encode(accountReference, msg.sender))
    /// @dev Một depositor không thể dùng lại cùng accountReference.
    ///      Depositor khác dùng cùng accountReference sẽ có depositKey khác
    ///      nhưng Backend sẽ từ chối vì depositor không khớp Deposit Intent.
    mapping(bytes32 depositKey => bool used) public usedDepositKeys;

    // ─── Errors ───────────────────────────────────────────────────────────────
    error UnsupportedToken(address token);
    error InvalidAmount();
    error InvalidAccountReference();
    /// @notice Khi cùng msg.sender đã dùng accountReference này rồi
    error DepositReferenceAlreadyUsed(bytes32 accountReference);
    error CannotRecoverSupportedToken(address token);
    error ZeroAddress();

    // ─── Events ───────────────────────────────────────────────────────────────
    /// @notice Phát mỗi khi Deposit thành công
    /// @param accountReference Mã bytes32 liên kết với Deposit Intent trong Backend
    /// @param depositor        Địa chỉ ví blockchain gửi token
    /// @param token            Địa chỉ ERC-20 contract
    /// @param amount           Số lượng raw (chưa chia decimals)
    event Deposited(
        bytes32 indexed accountReference,
        address indexed depositor,
        address indexed token,
        uint256 amount
    );

    event TokenSupportUpdated(address indexed token, bool supported);

    /// @notice Phát khi Admin thu hồi token bị gửi nhầm vào Vault
    event ERC20Recovered(address indexed token, address indexed to, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── User Functions ───────────────────────────────────────────────────────
    /// @notice Nạp token vào Vault. Phải ERC20.approve(vaultAddress, amount) trước.
    /// @dev accountReference là bytes32 nhận từ Backend Deposit Intent API.
    ///      One-time per depositor — không thể dùng lại cùng reference cho cùng địa chỉ.
    /// @param token            Địa chỉ ERC-20 (phải là supported token)
    /// @param amount           Số lượng raw token (> 0)
    /// @param accountReference Mã bytes32 từ Backend (khác bytes32(0))
    function deposit(
        address token,
        uint256 amount,
        bytes32 accountReference
    ) external whenNotPaused nonReentrant {
        if (!supportedTokens[token])        revert UnsupportedToken(token);
        if (amount == 0)                    revert InvalidAmount();
        if (accountReference == bytes32(0)) revert InvalidAccountReference();

        // depositKey unique per (accountReference, msg.sender)
        bytes32 depositKey = keccak256(abi.encode(accountReference, msg.sender));

        if (usedDepositKeys[depositKey]) revert DepositReferenceAlreadyUsed(accountReference);

        // Checks-Effects-Interactions: đánh dấu TRƯỚC khi transfer
        usedDepositKeys[depositKey] = true;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(accountReference, msg.sender, token, amount);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────
    /// @notice Cấu hình token được phép Deposit
    function setSupportedToken(
        address token,
        bool supported
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    /// @notice Thu hồi token bị gửi nhầm vào Vault (không phải supported token).
    /// @dev KHÔNG được dùng để rút token của user.
    ///      Supported token KHÔNG được recover — phải setSupportedToken(false) trước.
    /// @param token  Địa chỉ ERC-20 (phải là unsupported token)
    /// @param to     Địa chỉ nhận (không được là address(0))
    /// @param amount Số lượng muốn recover
    function recoverERC20(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (supportedTokens[token]) revert CannotRecoverSupportedToken(token);
        if (to == address(0))       revert ZeroAddress();

        IERC20(token).safeTransfer(to, amount);
        emit ERC20Recovered(token, to, amount);
    }

    // ─── Không nhận native ETH ────────────────────────────────────────────────
    // Không có receive() hoặc fallback() — revert khi nhận ETH
}