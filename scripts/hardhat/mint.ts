import { ethers, network } from "hardhat";

/**
 * Mint APEXMembershipNFT to specified addresses
 *
 * Usage:
 *   npx hardhat run scripts/hardhat/mint.ts --network <network>
 *
 * Environment variables:
 *   MEMBERSHIP_NFT_ADDRESS - Deployed contract address
 *   MINT_RECIPIENTS - Comma-separated list of addresses to mint to
 */
async function main() {
  console.log("=".repeat(60));
  console.log("APEX Membership NFT Minting");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name}`);
  console.log("");

  // Get contract address
  const contractAddress = process.env.MEMBERSHIP_NFT_ADDRESS;
  if (!contractAddress) {
    throw new Error("MEMBERSHIP_NFT_ADDRESS environment variable not set");
  }
  console.log(`Contract Address: ${contractAddress}`);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log("");

  // Get contract instance
  const APEXMembershipNFT = await ethers.getContractFactory("APEXMembershipNFT");
  const contract = APEXMembershipNFT.attach(contractAddress);

  // Get recipients from environment or use signer address for testing
  const recipientsEnv = process.env.MINT_RECIPIENTS;
  const recipients = recipientsEnv
    ? recipientsEnv.split(",").map(addr => addr.trim())
    : [signer.address];

  console.log(`Recipients (${recipients.length}):`);
  recipients.forEach((addr, i) => console.log(`  ${i + 1}. ${addr}`));
  console.log("");

  // Check current supply
  const totalMinted = await contract.totalMinted();
  const maxSupply = await contract.maxSupply();
  const supplyDisplay = maxSupply > 0 ? " / " + String(maxSupply) : " (unlimited)";
  console.log("Current Supply: " + String(totalMinted) + supplyDisplay);
  console.log("");

  // Mint to each recipient
  console.log("Minting memberships...");
  for (const recipient of recipients) {
    try {
      // Check if already has membership
      const hasMembership = await contract.hasMembership(recipient);
      if (hasMembership) {
        console.log(`  [SKIP] ${recipient} - already has membership`);
        continue;
      }

      // Mint
      const tx = await contract.mintMembership(recipient);
      const receipt = await tx.wait();

      // Get token ID from event (unused but kept for debugging)
      const _event = receipt?.logs.find(
        (log: { fragment?: { name: string } }) => log.fragment?.name === "MembershipMinted"
      );

      console.log(`  [OK] ${recipient} - Token minted (tx: ${tx.hash.slice(0, 10)}...)`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`  [FAIL] ${recipient} - ${errorMessage}`);
    }
  }

  // Final status
  console.log("");
  const newTotalMinted = await contract.totalMinted();
  console.log(`Total Minted After: ${newTotalMinted}`);
  console.log("=".repeat(60));
}

// Execute minting
try {
  await main();
  process.exit(0);
} catch (error) {
  console.error("Minting failed:", error);
  process.exit(1);
}
