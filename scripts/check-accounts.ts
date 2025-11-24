import { ethers } from "hardhat";

async function main() {
  const accounts = await ethers.getSigners();
  console.log("\n=== Hardhat Accounts ===\n");
  
  for (let i = 0; i < Math.min(10, accounts.length); i++) {
    const balance = await ethers.provider.getBalance(accounts[i].address);
    console.log(`Account ${i}:`);
    console.log(`  Address: ${accounts[i].address}`);
    console.log(`  Balance: ${ethers.formatEther(balance)} ETH`);
    // Note: In newer versions of ethers, privateKey might not be directly accessible
    // But we can check if it exists
    try {
      const privateKey = (accounts[i] as any).privateKey;
      if (privateKey) {
        console.log(`  Private Key: ${privateKey}`);
      } else {
        console.log(`  Private Key: Not directly accessible (this is normal)`);
      }
    } catch (e) {
      console.log(`  Private Key: Not accessible`);
    }
    console.log("");
  }
  
  console.log("\n=== Default Hardhat Account Private Keys ===");
  console.log("Hardhat uses deterministic accounts. Here are the first few:");
  console.log("Account 0: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  console.log("Account 1: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  console.log("Account 2: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
  console.log("\nThese are the well-known Hardhat test accounts.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

