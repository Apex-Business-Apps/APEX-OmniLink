// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title APEXMembershipNFT
 * @dev ERC721 NFT contract for APEX OmniHub premium membership
 * @notice This contract manages membership NFTs that grant premium access to APEX OmniHub
 *
 * Features:
 * - Owner-controlled minting (no public mint)
 * - Enumerable for easy wallet balance queries
 * - Pausable for emergency stops
 * - URI storage for individual token metadata
 * - Reentrancy protection
 * - Transfer event emission for Alchemy webhook tracking
 */
contract APEXMembershipNFT is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    Ownable,
    Pausable,
    ReentrancyGuard
{
    /// @dev Counter for token IDs
    uint256 private _nextTokenId;

    /// @dev Base URI for token metadata
    string private _baseTokenURI;

    /// @dev Mapping to track minted addresses (one NFT per address)
    mapping(address => bool) public hasMinted;

    /// @dev Maximum supply (0 = unlimited)
    uint256 public maxSupply;

    /// @dev Events
    event MembershipMinted(address indexed to, uint256 indexed tokenId);
    event MembershipRevoked(address indexed from, uint256 indexed tokenId);
    event BaseURIUpdated(string newBaseURI);
    event MaxSupplyUpdated(uint256 newMaxSupply);

    /**
     * @dev Constructor
     * @param initialOwner Address of the contract owner
     * @param baseURI Base URI for token metadata
     * @param _maxSupply Maximum number of NFTs (0 for unlimited)
     */
    constructor(
        address initialOwner,
        string memory baseURI,
        uint256 _maxSupply
    ) ERC721("APEX Membership", "APEXMEM") Ownable(initialOwner) {
        _baseTokenURI = baseURI;
        maxSupply = _maxSupply;
    }

    /**
     * @dev Mint a new membership NFT to an address
     * @param to Address to mint the NFT to
     * @notice Only owner can mint. Each address can only receive one NFT.
     */
    function mintMembership(address to) external onlyOwner whenNotPaused nonReentrant {
        require(to != address(0), "APEXMembershipNFT: mint to zero address");
        require(!hasMinted[to], "APEXMembershipNFT: address already has membership");

        if (maxSupply > 0) {
            require(_nextTokenId < maxSupply, "APEXMembershipNFT: max supply reached");
        }

        uint256 tokenId = _nextTokenId++;
        hasMinted[to] = true;

        _safeMint(to, tokenId);

        emit MembershipMinted(to, tokenId);
    }

    /**
     * @dev Batch mint membership NFTs to multiple addresses
     * @param recipients Array of addresses to mint NFTs to
     * @notice Only owner can batch mint
     */
    function batchMintMembership(address[] calldata recipients) external onlyOwner whenNotPaused nonReentrant {
        uint256 length = recipients.length;
        require(length > 0, "APEXMembershipNFT: empty recipients array");
        require(length <= 100, "APEXMembershipNFT: batch size exceeds limit");

        if (maxSupply > 0) {
            require(_nextTokenId + length <= maxSupply, "APEXMembershipNFT: would exceed max supply");
        }

        for (uint256 i = 0; i < length; i++) {
            address to = recipients[i];
            require(to != address(0), "APEXMembershipNFT: mint to zero address");

            if (!hasMinted[to]) {
                uint256 tokenId = _nextTokenId++;
                hasMinted[to] = true;
                _safeMint(to, tokenId);
                emit MembershipMinted(to, tokenId);
            }
        }
    }

    /**
     * @dev Revoke membership by burning the NFT
     * @param tokenId Token ID to burn
     * @notice Only owner can revoke memberships
     */
    function revokeMembership(uint256 tokenId) external onlyOwner nonReentrant {
        address owner = ownerOf(tokenId);
        hasMinted[owner] = false;
        _burn(tokenId);
        emit MembershipRevoked(owner, tokenId);
    }

    /**
     * @dev Set the base URI for token metadata
     * @param baseURI New base URI
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(baseURI);
    }

    /**
     * @dev Set individual token URI
     * @param tokenId Token ID
     * @param _tokenURI Token-specific URI
     */
    function setTokenURI(uint256 tokenId, string memory _tokenURI) external onlyOwner {
        _setTokenURI(tokenId, _tokenURI);
    }

    /**
     * @dev Update maximum supply
     * @param _maxSupply New maximum supply (must be >= current supply, or 0 for unlimited)
     */
    function setMaxSupply(uint256 _maxSupply) external onlyOwner {
        require(_maxSupply == 0 || _maxSupply >= _nextTokenId, "APEXMembershipNFT: new max below current supply");
        maxSupply = _maxSupply;
        emit MaxSupplyUpdated(_maxSupply);
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Check if an address holds a membership NFT
     * @param account Address to check
     * @return bool True if address holds a membership
     */
    function hasMembership(address account) external view returns (bool) {
        return balanceOf(account) > 0;
    }

    /**
     * @dev Get total number of minted tokens
     * @return uint256 Total supply
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @dev Get remaining mintable tokens (0 if unlimited)
     * @return uint256 Remaining supply
     */
    function remainingSupply() external view returns (uint256) {
        if (maxSupply == 0) return type(uint256).max;
        return maxSupply - _nextTokenId;
    }

    // ============ OVERRIDES ============

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        // Update hasMinted tracking on transfer
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            hasMinted[from] = false;
        }
        if (to != address(0)) {
            hasMinted[to] = true;
        }

        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
