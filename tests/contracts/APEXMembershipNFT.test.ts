/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from "chai";
import { ethers } from "hardhat";
import { APEXMembershipNFT } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("APEXMembershipNFT", function () {
  let contract: APEXMembershipNFT;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  const BASE_URI = "https://api.apexomnihub.com/nft/metadata/";
  const MAX_SUPPLY = 1000;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const APEXMembershipNFT = await ethers.getContractFactory("APEXMembershipNFT");
    contract = await APEXMembershipNFT.deploy(owner.address, BASE_URI, MAX_SUPPLY);
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct name and symbol", async function () {
      expect(await contract.name()).to.equal("APEX Membership");
      expect(await contract.symbol()).to.equal("APEXMEM");
    });

    it("should set the correct owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should set the correct max supply", async function () {
      expect(await contract.maxSupply()).to.equal(MAX_SUPPLY);
    });

    it("should start with zero minted tokens", async function () {
      expect(await contract.totalMinted()).to.equal(0);
    });

    it("should not be paused by default", async function () {
      expect(await contract.paused()).to.be.false;
    });
  });

  describe("Minting", function () {
    it("should allow owner to mint a membership NFT", async function () {
      await expect(contract.mintMembership(user1.address))
        .to.emit(contract, "MembershipMinted")
        .withArgs(user1.address, 0);

      expect(await contract.balanceOf(user1.address)).to.equal(1);
      expect(await contract.ownerOf(0)).to.equal(user1.address);
    });

    it("should prevent non-owner from minting", async function () {
      await expect(
        contract.connect(user1).mintMembership(user2.address)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("should prevent minting to zero address", async function () {
      await expect(
        contract.mintMembership(ethers.ZeroAddress)
      ).to.be.revertedWith("APEXMembershipNFT: mint to zero address");
    });

    it("should prevent minting twice to same address", async function () {
      await contract.mintMembership(user1.address);
      await expect(
        contract.mintMembership(user1.address)
      ).to.be.revertedWith("APEXMembershipNFT: address already has membership");
    });

    it("should increment token IDs correctly", async function () {
      await contract.mintMembership(user1.address);
      await contract.mintMembership(user2.address);

      expect(await contract.ownerOf(0)).to.equal(user1.address);
      expect(await contract.ownerOf(1)).to.equal(user2.address);
      expect(await contract.totalMinted()).to.equal(2);
    });
  });

  describe("Batch Minting", function () {
    it("should allow owner to batch mint", async function () {
      const recipients = [user1.address, user2.address, user3.address];
      await contract.batchMintMembership(recipients);

      expect(await contract.totalMinted()).to.equal(3);
      expect(await contract.balanceOf(user1.address)).to.equal(1);
      expect(await contract.balanceOf(user2.address)).to.equal(1);
      expect(await contract.balanceOf(user3.address)).to.equal(1);
    });

    it("should skip already minted addresses in batch", async function () {
      await contract.mintMembership(user1.address);

      const recipients = [user1.address, user2.address];
      await contract.batchMintMembership(recipients);

      expect(await contract.totalMinted()).to.equal(2);
      expect(await contract.balanceOf(user1.address)).to.equal(1);
    });

    it("should reject empty batch", async function () {
      await expect(
        contract.batchMintMembership([])
      ).to.be.revertedWith("APEXMembershipNFT: empty recipients array");
    });

    it("should enforce batch size limit", async function () {
      const recipients = Array(101).fill(user1.address);
      await expect(
        contract.batchMintMembership(recipients)
      ).to.be.revertedWith("APEXMembershipNFT: batch size exceeds limit");
    });
  });

  describe("Membership Revocation", function () {
    it("should allow owner to revoke membership", async function () {
      await contract.mintMembership(user1.address);

      await expect(contract.revokeMembership(0))
        .to.emit(contract, "MembershipRevoked")
        .withArgs(user1.address, 0);

      expect(await contract.balanceOf(user1.address)).to.equal(0);
      expect(await contract.hasMinted(user1.address)).to.be.false;
    });

    it("should allow re-minting after revocation", async function () {
      await contract.mintMembership(user1.address);
      await contract.revokeMembership(0);
      await contract.mintMembership(user1.address);

      expect(await contract.balanceOf(user1.address)).to.equal(1);
    });
  });

  describe("Max Supply", function () {
    it("should enforce max supply", async function () {
      // Deploy with max supply of 2
      const APEXMembershipNFT = await ethers.getContractFactory("APEXMembershipNFT");
      const limitedContract = await APEXMembershipNFT.deploy(owner.address, BASE_URI, 2);
      await limitedContract.waitForDeployment();

      await limitedContract.mintMembership(user1.address);
      await limitedContract.mintMembership(user2.address);

      await expect(
        limitedContract.mintMembership(user3.address)
      ).to.be.revertedWith("APEXMembershipNFT: max supply reached");
    });

    it("should allow unlimited minting when max supply is 0", async function () {
      const APEXMembershipNFT = await ethers.getContractFactory("APEXMembershipNFT");
      const unlimitedContract = await APEXMembershipNFT.deploy(owner.address, BASE_URI, 0);
      await unlimitedContract.waitForDeployment();

      // Should not revert
      await unlimitedContract.mintMembership(user1.address);
      await unlimitedContract.mintMembership(user2.address);
    });

    it("should track remaining supply correctly", async function () {
      expect(await contract.remainingSupply()).to.equal(MAX_SUPPLY);

      await contract.mintMembership(user1.address);
      expect(await contract.remainingSupply()).to.equal(MAX_SUPPLY - 1);
    });
  });

  describe("Pausable", function () {
    it("should allow owner to pause", async function () {
      await contract.pause();
      expect(await contract.paused()).to.be.true;
    });

    it("should prevent minting when paused", async function () {
      await contract.pause();
      await expect(
        contract.mintMembership(user1.address)
      ).to.be.revertedWithCustomError(contract, "EnforcedPause");
    });

    it("should allow owner to unpause", async function () {
      await contract.pause();
      await contract.unpause();
      expect(await contract.paused()).to.be.false;

      // Should work again
      await contract.mintMembership(user1.address);
      expect(await contract.balanceOf(user1.address)).to.equal(1);
    });
  });

  describe("Transfers", function () {
    it("should update hasMinted tracking on transfer", async function () {
      await contract.mintMembership(user1.address);
      expect(await contract.hasMinted(user1.address)).to.be.true;
      expect(await contract.hasMinted(user2.address)).to.be.false;

      await contract.connect(user1).transferFrom(user1.address, user2.address, 0);

      expect(await contract.hasMinted(user1.address)).to.be.false;
      expect(await contract.hasMinted(user2.address)).to.be.true;
    });

    it("should allow minting to previous owner after transfer", async function () {
      await contract.mintMembership(user1.address);
      await contract.connect(user1).transferFrom(user1.address, user2.address, 0);

      // user1 can now receive a new NFT
      await contract.mintMembership(user1.address);
      expect(await contract.balanceOf(user1.address)).to.equal(1);
    });
  });

  describe("Membership Check", function () {
    it("should return true for addresses with membership", async function () {
      await contract.mintMembership(user1.address);
      expect(await contract.hasMembership(user1.address)).to.be.true;
    });

    it("should return false for addresses without membership", async function () {
      expect(await contract.hasMembership(user1.address)).to.be.false;
    });
  });

  describe("Token URI", function () {
    it("should return correct token URI", async function () {
      await contract.mintMembership(user1.address);
      expect(await contract.tokenURI(0)).to.equal(BASE_URI + "0");
    });

    it("should allow owner to set individual token URI", async function () {
      await contract.mintMembership(user1.address);
      const customURI = "ipfs://custom-metadata";
      await contract.setTokenURI(0, customURI);

      expect(await contract.tokenURI(0)).to.equal(customURI);
    });

    it("should allow owner to update base URI", async function () {
      const newBaseURI = "https://new-api.apexomnihub.com/nft/";
      await expect(contract.setBaseURI(newBaseURI))
        .to.emit(contract, "BaseURIUpdated")
        .withArgs(newBaseURI);

      await contract.mintMembership(user1.address);
      expect(await contract.tokenURI(0)).to.equal(newBaseURI + "0");
    });
  });

  describe("ERC721 Enumerable", function () {
    it("should track total supply", async function () {
      await contract.mintMembership(user1.address);
      await contract.mintMembership(user2.address);

      expect(await contract.totalSupply()).to.equal(2);
    });

    it("should enumerate tokens by owner", async function () {
      await contract.mintMembership(user1.address);
      await contract.mintMembership(user2.address);

      // Mint second token to user1 via transfer
      await contract.connect(user2).transferFrom(user2.address, user1.address, 1);

      expect(await contract.tokenOfOwnerByIndex(user1.address, 0)).to.equal(0);
      expect(await contract.tokenOfOwnerByIndex(user1.address, 1)).to.equal(1);
    });

    it("should enumerate all tokens", async function () {
      await contract.mintMembership(user1.address);
      await contract.mintMembership(user2.address);

      expect(await contract.tokenByIndex(0)).to.equal(0);
      expect(await contract.tokenByIndex(1)).to.equal(1);
    });
  });

  describe("Supports Interface", function () {
    it("should support ERC721", async function () {
      expect(await contract.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("should support ERC721Enumerable", async function () {
      expect(await contract.supportsInterface("0x780e9d63")).to.be.true;
    });

    it("should support ERC721Metadata", async function () {
      expect(await contract.supportsInterface("0x5b5e139f")).to.be.true;
    });
  });
});
