// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing on testnets
 * @dev Allows free minting for testing purposes only
 *
 * SECURITY: This contract is for TESTNET USE ONLY
 * Do NOT deploy to mainnet - anyone can mint tokens
 *
 * @author APEX OmniHub
 * @custom:phase Phase 0 - Polygon Amoy Testnet
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;
    uint256 public constant MAX_MINT_PER_TX = 1_000_000 * 10 ** DECIMALS; // 1M per tx

    event TokensMinted(address indexed to, uint256 amount);

    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {
        // Mint initial supply to deployer for testing
        _mint(msg.sender, 100_000 * 10 ** DECIMALS);
    }

    /**
     * @notice Returns the number of decimals (USDC standard: 6)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Mint tokens to any address (TESTNET ONLY)
     * @param to Recipient address
     * @param amount Amount to mint (in wei units, 6 decimals)
     */
    function mint(address to, uint256 amount) external {
        require(to != address(0), "MockUSDC: mint to zero address");
        require(amount > 0, "MockUSDC: amount must be > 0");
        require(amount <= MAX_MINT_PER_TX, "MockUSDC: exceeds max mint");

        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Burn tokens from caller's balance
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Faucet function - mint 1000 mUSDC to caller
     * @dev Convenience function for testing
     */
    function faucet() external {
        uint256 amount = 1000 * 10 ** DECIMALS;
        _mint(msg.sender, amount);
        emit TokensMinted(msg.sender, amount);
    }
}
