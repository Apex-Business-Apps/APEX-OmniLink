/**
 * APEX OmniHub - Phase 0 Deployment Script
 *
 * Deploys to Polygon Amoy Testnet:
 *   1. MockUSDC (test payment token)
 *   2. ApexGenesisKeyV3 (Genesis Key NFT)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-phase0.js --network polygonAmoy
 *
 * Prerequisites:
 *   - AMOY_RPC_URL and PRIVATE_KEY in .env
 *   - Deployer wallet funded with Amoy MATIC
 *
 * @author APEX OmniHub
 * @date 2026-01-24
 */

const hre = require("hardhat");

// =============================================================
//                     ETHERS v5/v6 COMPATIBILITY
// =============================================================

/**
 * Parse units compatible with ethers v5 and v6
 * @param {string} value - Value to parse
 * @param {number} decimals - Number of decimals
 * @returns {BigNumber|bigint} Parsed value
 */
function parseUnitsCompat(value, decimals) {
  // ethers v6
  if (hre.ethers.parseUnits) {
    return hre.ethers.parseUnits(value, decimals);
  }
  // ethers v5
  return hre.ethers.utils.parseUnits(value, decimals);
}

/**
 * Format units compatible with ethers v5 and v6
 * @param {BigNumber|bigint} value - Value to format
 * @param {number} decimals - Number of decimals
 * @returns {string} Formatted value
 */
function formatUnitsCompat(value, decimals) {
  // ethers v6
  if (hre.ethers.formatUnits) {
    return hre.ethers.formatUnits(value, decimals);
  }
  // ethers v5
  return hre.ethers.utils.formatUnits(value, decimals);
}

/**
 * Wait for contract deployment (v5/v6 compatible)
 * @param {Contract} contract - Contract instance
 * @returns {Promise<Contract>} Deployed contract
 */
async function waitDeployed(contract) {
  // ethers v6
  if (contract.waitForDeployment) {
    return contract.waitForDeployment();
  }
  // ethers v5
  return contract.deployed();
}

/**
 * Get contract address (v5/v6 compatible)
 * @param {Contract} contract - Contract instance
 * @returns {Promise<string>} Contract address
 */
async function getAddress(contract) {
  // ethers v6
  if (contract.getAddress) {
    return contract.getAddress();
  }
  // ethers v5
  return contract.address;
}

// =============================================================
//                        MAIN DEPLOYMENT
// =============================================================

async function main() {
  console.log("\n🛡️  ═══════════════════════════════════════════════════════");
  console.log("    APEX OMNIHUB - PHASE 0 DEPLOYMENT");
  console.log("    Network: Polygon Amoy Testnet (Chain ID: 80002)");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = deployer.address ?? (await deployer.getAddress());

  console.log("🔑 Deployer:", deployerAddress);

  // Check deployer balance
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  const balanceEth = formatUnitsCompat(balance, 18);
  console.log("💰 Balance:", balanceEth, "MATIC\n");

  if (parseFloat(balanceEth) < 0.01) {
    console.error("❌ ERROR: Insufficient MATIC balance for deployment");
    console.error("   Fund your wallet at: https://faucet.polygon.technology/");
    process.exit(1);
  }

  // =========================================================
  // STEP 1: Deploy MockUSDC
  // =========================================================
  console.log("1️⃣  Deploying MockUSDC (Test Payment Token)...");
  console.log("   ├─ Symbol: mUSDC");
  console.log("   ├─ Decimals: 6");

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await waitDeployed(usdc);

  const usdcAddress = await getAddress(usdc);
  console.log("   └─ ✅ Deployed:", usdcAddress);

  // Mint test tokens to deployer
  const decimals = await usdc.decimals();
  const mintAmount = parseUnitsCompat("10000", decimals);

  console.log("\n💸 Minting 10,000 mUSDC to deployer...");
  const mintTx = await usdc.mint(deployerAddress, mintAmount);
  await mintTx.wait();
  console.log("   └─ ✅ Minted successfully");

  // =========================================================
  // STEP 2: Deploy ApexGenesisKeyV3
  // =========================================================
  console.log("\n2️⃣  Deploying ApexGenesisKeyV3 (Genesis Key NFT)...");

  const METADATA_URI = "ipfs://QmYourTestCID/";
  const TREASURY = deployerAddress;
  const PRICE = parseUnitsCompat("500", decimals); // 500 mUSDC

  console.log("   ├─ Name: APEX Genesis Key");
  console.log("   ├─ Symbol: APEX");
  console.log("   ├─ Max Supply: 1,000");
  console.log("   ├─ Max Per Wallet: 5");
  console.log("   ├─ Metadata URI:", METADATA_URI);
  console.log("   ├─ Payment Token:", usdcAddress);
  console.log("   ├─ Treasury:", TREASURY);
  console.log("   └─ Price: 500.00 mUSDC");

  const ApexKey = await hre.ethers.getContractFactory("ApexGenesisKeyV3");
  const key = await ApexKey.deploy(METADATA_URI, usdcAddress, TREASURY, PRICE);
  await waitDeployed(key);

  const keyAddress = await getAddress(key);
  console.log("\n   ✅ Deployed:", keyAddress);

  // Verify deployment state
  const owner = await key.owner();
  const isSaleActive = await key.isSaleActive();

  console.log("\n📋 Contract State:");
  console.log("   ├─ Owner:", owner);
  console.log("   ├─ Sale Active:", isSaleActive);

  // =========================================================
  // STEP 3: Open Sale
  // =========================================================
  console.log("\n3️⃣  Opening sale...");
  const toggleTx = await key.toggleSale();
  await toggleTx.wait();

  const newSaleState = await key.isSaleActive();
  console.log("   └─ ✅ Sale is now:", newSaleState ? "OPEN" : "CLOSED");

  // =========================================================
  // STEP 4: Approve spend for test mint
  // =========================================================
  console.log("\n4️⃣  Approving mUSDC spend for test mint...");
  const approveTx = await usdc.approve(keyAddress, PRICE);
  await approveTx.wait();
  console.log("   └─ ✅ Approved 500 mUSDC");

  // =========================================================
  // DEPLOYMENT SUMMARY
  // =========================================================
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                    DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("📦 Contract Addresses:");
  console.log("   ├─ MockUSDC:          ", usdcAddress);
  console.log("   └─ ApexGenesisKeyV3:  ", keyAddress);

  console.log("\n🔗 Block Explorers:");
  console.log(`   ├─ MockUSDC:          https://amoy.polygonscan.com/address/${usdcAddress}`);
  console.log(`   └─ ApexGenesisKeyV3:  https://amoy.polygonscan.com/address/${keyAddress}`);

  console.log("\n📝 Next Steps:");
  console.log("   1. Update .env with MEMBERSHIP_NFT_ADDRESS=" + keyAddress);
  console.log("   2. Test mint in Hardhat console:");
  console.log("      npx hardhat console --network polygonAmoy");
  console.log(`      const key = await ethers.getContractAt("ApexGenesisKeyV3", "${keyAddress}")`);
  console.log("      await key.mint(1)");
  console.log("      await key.balanceOf(await (await ethers.getSigners())[0].getAddress())");

  console.log("\n🎉 Phase 0 deployment successful!\n");

  // Return addresses for testing
  return {
    mockUSDC: usdcAddress,
    apexGenesisKey: keyAddress,
    deployer: deployerAddress,
    treasury: TREASURY,
    price: PRICE.toString(),
  };
}

// Execute deployment
main()
  .then((result) => {
    console.log("Deployment result:", JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error(error);
    process.exit(1);
  });
