import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Helper function for delays between transactions
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🎮 Deploying BlOcXTacToe contract...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Network:", network.name, "(Chain ID:", network.chainId.toString(), ")\n");

  // Get current nonce
  const nonce = await ethers.provider.getTransactionCount(deployer.address);
  console.log("Starting deployment with nonce:", nonce, "\n");

  try {
    // Deploy BlOcXTacToe contract
    console.log("Deploying BlOcXTacToe contract...");
    const BlOcXTacToe = await ethers.getContractFactory("BlOcXTacToe");
    const blocXTacToe = await BlOcXTacToe.deploy();
    
    console.log("Waiting for deployment confirmation...");
    await blocXTacToe.waitForDeployment();
    
    const contractAddress = await blocXTacToe.getAddress();
    console.log("✅ BlOcXTacToe deployed to:", contractAddress);

    // Get deployment transaction and wait for confirmation
    const deployTx = blocXTacToe.deploymentTransaction();
    if (deployTx) {
      console.log("Deployment transaction hash:", deployTx.hash);
      console.log("Waiting for transaction confirmation (waiting for 2 block confirmations)...");
      
      // Wait for transaction to be mined with 2 confirmations
      const receipt = await deployTx.wait(2);
      console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
      
      // Wait a bit more for network to settle (5 seconds)
      console.log("Waiting for network to settle...");
      await sleep(5000);
      
      // Verify the contract is actually deployed by checking its owner
      try {
        const owner = await blocXTacToe.owner();
        console.log("✅ Contract verified - Owner:", owner);
      } catch (error) {
        console.warn("⚠️  Could not verify contract owner (contract may still be propagating)");
      }
    }

    // Get deployment info
    const deploymentInfo = {
      contractName: "BlOcXTacToe",
      address: contractAddress,
      deployer: deployer.address,
      network: network.name,
      chainId: network.chainId.toString(),
      transactionHash: deployTx?.hash || "N/A",
      timestamp: new Date().toISOString(),
      blockNumber: await ethers.provider.getBlockNumber(),
      // Contract details
      moveTimeout: "24 hours (configurable)",
      platformFeePercent: "0% (configurable)",
      constructorArgs: [] // No constructor arguments
    };

    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log("Contract Name: BlOcXTacToe");
    console.log("Address:", contractAddress);
    console.log("Network:", network.name, "(Chain ID:", network.chainId.toString(), ")");
    console.log("Deployer:", deployer.address);
    console.log("Transaction Hash:", deployTx?.hash || "N/A");
    console.log("Block Number:", deploymentInfo.blockNumber);
    console.log("Timestamp:", deploymentInfo.timestamp);
    console.log("=========================\n");

    // Save deployment info to JSON file
    const deploymentDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentDir, `${network.name}-${network.chainId}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info saved to:", deploymentFile);

    // Also save to root deployment.json for easy access
    const rootDeploymentFile = path.join(__dirname, "../deployment.json");
    fs.writeFileSync(rootDeploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info also saved to: deployment.json");

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Update your .env file with the contract address:");
    console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
    console.log("\n2. Verify the contract:");
    console.log(`   npx hardhat verify --network ${network.name} ${contractAddress}`);
    console.log("   OR");
    console.log(`   npm run verify:${network.name}`);

  } catch (error: any) {
    console.error("\n❌ Deployment failed:", error);
    if (error.transaction) {
      console.error("Transaction:", error.transaction);
    }
    if (error.receipt) {
      console.error("Receipt:", error.receipt);
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
