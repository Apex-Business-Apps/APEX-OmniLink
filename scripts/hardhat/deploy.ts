import { ethers, network, run } from "hardhat";

/**
 * Deploy APEXMembershipNFT contract
 *
 * Usage:
 *   npx hardhat run scripts/hardhat/deploy.ts --network <network>
 *
 * Networks:
 *   - localhost (local hardhat node)
 *   - sepolia (Ethereum testnet)
 *   - amoy (Polygon testnet)
 *   - mainnet (Ethereum mainnet)
 *   - polygon (Polygon mainnet)
 */
async function main() {
  console.log("=".repeat(60));
  console.log("APEX Membership NFT Deployment");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${network.config.chainId}`);
  console.log("");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);
  console.log("");

  // Deployment configuration
  const config = {
    baseURI: process.env.NFT_BASE_URI || "https://api.apexomnihub.com/nft/metadata/",
    maxSupply: process.env.NFT_MAX_SUPPLY ? Number.parseInt(process.env.NFT_MAX_SUPPLY, 10) : 0, // 0 = unlimited
  };

  console.log("Deployment Configuration:");
  console.log(`  Base URI: ${config.baseURI}`);
  console.log(`  Max Supply: ${config.maxSupply === 0 ? "Unlimited" : config.maxSupply}`);
  console.log("");

  // Deploy contract
  console.log("Deploying APEXMembershipNFT...");
  const APEXMembershipNFT = await ethers.getContractFactory("APEXMembershipNFT");
  const contract = await APEXMembershipNFT.deploy(
    deployer.address,
    config.baseURI,
    config.maxSupply
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("");
  console.log("=".repeat(60));
  console.log("DEPLOYMENT SUCCESSFUL");
  console.log("=".repeat(60));
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Transaction Hash: ${contract.deploymentTransaction()?.hash}`);
  console.log("");

  // Verify on block explorer (skip for local networks)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations before verification...");
    await contract.deploymentTransaction()?.wait(5);

    console.log("Verifying contract on block explorer...");
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [
          deployer.address,
          config.baseURI,
          config.maxSupply,
        ],
      });
      console.log("Contract verified successfully!");
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("Already Verified")) {
        console.log("Contract is already verified.");
      } else {
        console.error("Verification failed:", error);
      }
    }
  }

  // Output deployment info for CI/CD
  console.log("");
  console.log("=".repeat(60));
  console.log("NEXT STEPS");
  console.log("=".repeat(60));
  console.log("1. Update .env.local with the contract address:");
  console.log(`   MEMBERSHIP_NFT_ADDRESS=${contractAddress}`);
  console.log("");
  console.log("2. Configure Alchemy webhook to track Transfer events");
  console.log(`   Contract: ${contractAddress}`);
  console.log("   Event: Transfer(address,address,uint256)");
  console.log("");
  console.log("3. Test minting:");
  console.log(`   npx hardhat run scripts/hardhat/mint.ts --network ${network.name}`);
  console.log("=".repeat(60));

  return {
    address: contractAddress,
    deployer: deployer.address,
    network: network.name,
    chainId: network.config.chainId,
  };
}

// Execute deployment
try {
  const result = await main();
  console.log("\nDeployment result:", JSON.stringify(result, null, 2));
  process.exit(0);
} catch (error) {
  console.error("Deployment failed:", error);
  process.exit(1);
}
