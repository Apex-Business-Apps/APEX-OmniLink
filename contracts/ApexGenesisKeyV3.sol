// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ApexGenesisKeyV3
 * @notice APEX Genesis Key NFT - Premium membership token for APEX OmniHub
 * @dev ERC721A implementation for gas-efficient batch minting
 *
 * Features:
 *   - ERC20 payment token support (USDC)
 *   - Per-wallet mint limits
 *   - Owner-controlled sale state
 *   - Configurable pricing and treasury
 *   - Gas-optimized batch minting via ERC721A
 *
 * Security:
 *   - ReentrancyGuard on mint
 *   - SafeERC20 for token transfers
 *   - Owner-only admin functions
 *   - Zero-address validation
 *
 * @author APEX OmniHub
 * @custom:phase Phase 0 - Polygon Amoy Testnet
 */
contract ApexGenesisKeyV3 is ERC721A, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    //                           CONSTANTS
    // =============================================================

    /// @notice Maximum total supply of Genesis Keys
    uint256 public constant MAX_SUPPLY = 1000;

    /// @notice Maximum NFTs per wallet
    uint256 public constant MAX_PER_WALLET = 5;

    // =============================================================
    //                           STORAGE
    // =============================================================

    /// @notice ERC20 token used for payment (e.g., USDC)
    IERC20 public paymentToken;

    /// @notice Treasury address receiving mint payments
    address public treasury;

    /// @notice Price per NFT in payment token units
    uint256 public mintPrice;

    /// @notice Base URI for token metadata
    string public baseURI;

    /// @notice Whether minting is currently active
    bool public isSaleActive = false;

    // =============================================================
    //                           EVENTS
    // =============================================================

    /// @notice Emitted when NFTs are minted
    event GenesisMinted(address indexed minter, uint256 quantity, uint256 cost);

    /// @notice Emitted when economy config is updated
    event ConfigUpdated(address indexed token, address indexed treasury, uint256 price);

    /// @notice Emitted when sale state changes
    event SaleStateChanged(bool active);

    /// @notice Emitted when base URI is updated
    event BaseURIUpdated(string newBaseURI);

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    /**
     * @notice Initialize the Genesis Key contract
     * @param _initBaseURI Initial metadata base URI (IPFS recommended)
     * @param _paymentToken ERC20 token address for payments
     * @param _treasury Treasury address for receiving payments
     * @param _initialPrice Initial mint price in payment token units
     */
    constructor(
        string memory _initBaseURI,
        address _paymentToken,
        address _treasury,
        uint256 _initialPrice
    ) ERC721A("APEX Genesis Key", "APEX") Ownable(msg.sender) {
        require(_paymentToken != address(0), "Token=0");
        require(_treasury != address(0), "Treasury=0");
        require(_initialPrice > 0, "Price=0");

        baseURI = _initBaseURI;
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
        mintPrice = _initialPrice;

        emit ConfigUpdated(_paymentToken, _treasury, _initialPrice);
    }

    // =============================================================
    //                        VIEW FUNCTIONS
    // =============================================================

    /**
     * @notice Calculate total cost for a given quantity
     * @param quantity Number of NFTs to mint
     * @return Total cost in payment token units
     */
    function cost(uint256 quantity) public view returns (uint256) {
        return mintPrice * quantity;
    }

    /**
     * @notice Get number of NFTs minted by an address
     * @param owner Address to check
     * @return Number minted
     */
    function numberMinted(address owner) external view returns (uint256) {
        return _numberMinted(owner);
    }

    /**
     * @notice Check if an address can mint a given quantity
     * @param minter Address to check
     * @param quantity Desired mint quantity
     * @return canMintResult Whether the mint would succeed
     * @return reason Reason if cannot mint
     */
    function canMint(address minter, uint256 quantity) external view returns (bool canMintResult, string memory reason) {
        if (!isSaleActive) return (false, "Sale not active");
        if (quantity == 0) return (false, "Quantity is zero");
        if (totalSupply() + quantity > MAX_SUPPLY) return (false, "Exceeds max supply");
        if (_numberMinted(minter) + quantity > MAX_PER_WALLET) return (false, "Exceeds wallet limit");
        return (true, "");
    }

    // =============================================================
    //                        MINT FUNCTION
    // =============================================================

    /**
     * @notice Mint Genesis Key NFTs
     * @param quantity Number of NFTs to mint (1-5)
     * @dev Requires prior approval of payment token
     */
    function mint(uint256 quantity) external nonReentrant {
        require(isSaleActive, "Factory closed");
        require(quantity > 0, "Qty=0");
        require(totalSupply() + quantity <= MAX_SUPPLY, "Sold out");
        require(_numberMinted(msg.sender) + quantity <= MAX_PER_WALLET, "Wallet limit");

        uint256 totalCost = mintPrice * quantity;
        paymentToken.safeTransferFrom(msg.sender, treasury, totalCost);

        _safeMint(msg.sender, quantity);
        emit GenesisMinted(msg.sender, quantity, totalCost);
    }

    // =============================================================
    //                       ADMIN FUNCTIONS
    // =============================================================

    /**
     * @notice Update payment configuration
     * @param _token New payment token address
     * @param _treasury New treasury address
     * @param _price New mint price
     */
    function setEconomyConfig(address _token, address _treasury, uint256 _price) external onlyOwner {
        require(_token != address(0), "Token=0");
        require(_treasury != address(0), "Treasury=0");
        require(_price > 0, "Price=0");

        paymentToken = IERC20(_token);
        treasury = _treasury;
        mintPrice = _price;

        emit ConfigUpdated(_token, _treasury, _price);
    }

    /**
     * @notice Toggle sale active state
     */
    function toggleSale() external onlyOwner {
        isSaleActive = !isSaleActive;
        emit SaleStateChanged(isSaleActive);
    }

    /**
     * @notice Update base URI for token metadata
     * @param _newBaseURI New base URI
     */
    function setBaseURI(string memory _newBaseURI) external onlyOwner {
        baseURI = _newBaseURI;
        emit BaseURIUpdated(_newBaseURI);
    }

    // =============================================================
    //                       INTERNAL OVERRIDES
    // =============================================================

    /**
     * @dev Returns base URI for computing tokenURI
     */
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    /**
     * @dev Start token IDs at 1 instead of 0
     */
    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }
}
