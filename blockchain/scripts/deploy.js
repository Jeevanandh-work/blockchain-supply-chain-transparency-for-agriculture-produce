const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function updateEnvFile(filePath, key, value) {
  const line = `${key}=${value}`;

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${line}\n`);
    return;
  }

  const current = fs.readFileSync(filePath, 'utf8');
  const matcher = new RegExp(`^${key}=.*$`, 'm');

  if (matcher.test(current)) {
    fs.writeFileSync(filePath, current.replace(matcher, line));
  } else {
    const trimmed = current.endsWith('\n') ? current : `${current}\n`;
    fs.writeFileSync(filePath, `${trimmed}${line}\n`);
  }
}

async function main() {
  console.log("🚀 Deploying SupplyChain contract...\n");

  // Get the contract factory
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  
  // Deploy the contract
  console.log("⏳ Deploying contract...");
  const supplyChain = await SupplyChain.deploy();
  
  await supplyChain.waitForDeployment();
  
  const address = await supplyChain.getAddress();
  const deployer = (await hre.ethers.getSigners())[0];
  
  console.log(`✅ SupplyChain contract deployed to: ${address}`);
  console.log(`📍 Network: ${hre.network.name}`);
  console.log(`👤 Deployer: ${deployer.address}\n`);
  
  // Save deployment info to blockchain folder
  const deploymentInfo = {
    address: address,
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
  };
  
  const blockchainDeploymentPath = path.join(__dirname, "../deployment.json");
  fs.writeFileSync(
    blockchainDeploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`💾 Deployment info saved to ${blockchainDeploymentPath}`);
  
  // Copy to backend folder
  const backendDeploymentPath = path.join(__dirname, "../../backend/deployment.json");
  fs.writeFileSync(
    backendDeploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`💾 Deployment info copied to ${backendDeploymentPath}`);
  
  // Copy contract ABI to frontend
  const artifactPath = path.join(__dirname, "../artifacts/contracts/SupplyChain.sol/SupplyChain.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  
  const frontendABIPath = path.join(__dirname, "../../frontend/src/contracts/SupplyChain.json");
  const frontendDir = path.dirname(frontendABIPath);
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }
  
  fs.writeFileSync(
    frontendABIPath,
    JSON.stringify({
      address: address,
      abi: artifact.abi,
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    }, null, 2)
  );
  console.log(`💾 Contract ABI copied to ${frontendABIPath}\n`);

  // Update environment files with deployed address
  const backendEnvPath = path.join(__dirname, '../../backend/.env');
  const frontendEnvPath = path.join(__dirname, '../../frontend/.env');
  updateEnvFile(backendEnvPath, 'CONTRACT_ADDRESS', address);
  updateEnvFile(frontendEnvPath, 'REACT_APP_CONTRACT_ADDRESS', address);
  console.log(`💾 Environment files updated with deployed address\n`);
  
  // Assign test roles for localhost development
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("🔐 Assigning test roles...\n");
    const signers = await hre.ethers.getSigners();
    
    if (signers.length >= 5) {
      // Roles: 1-Farmer, 2-Distributor, 3-Transport, 4-Retailer, 5-Consumer
      try {
        await supplyChain.assignRole(signers[1].address, 1); // Farmer
        console.log(`✅ Farmer role assigned to: ${signers[1].address}`);
        
        await supplyChain.assignRole(signers[2].address, 2); // Distributor
        console.log(`✅ Distributor role assigned to: ${signers[2].address}`);
        
        await supplyChain.assignRole(signers[3].address, 3); // Transport
        console.log(`✅ Transport role assigned to: ${signers[3].address}`);
        
        await supplyChain.assignRole(signers[4].address, 4); // Retailer
        console.log(`✅ Retailer role assigned to: ${signers[4].address}\n`);
      } catch (error) {
        console.error("❌ Error assigning roles:", error.message);
      }
    }
    
    // Create a test batch
    console.log("🧪 Creating test batch...\n");
    try {
      const testBatchId = "BATCH-TEST-001";
      const testIPFSHash = "QmTestHash123456789";
      
      const tx = await supplyChain.connect(signers[1]).createBatch(
        testBatchId,
        testIPFSHash
      );
      await tx.wait();
      
      console.log(`✅ Test batch created: ${testBatchId}`);
      console.log(`📄 IPFS Hash: ${testIPFSHash}`);
      console.log(`🔗 Transaction: ${tx.hash}\n`);
    } catch (error) {
      console.error("❌ Error creating test batch:", error.message, "\n");
    }
  }
  
  // Verify contract on testnet (if not localhost)
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("⏳ Waiting for block confirmations...");
    await supplyChain.deploymentTransaction().wait(6);
    
    console.log("📝 Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Etherscan\n");
    } catch (error) {
      console.error("❌ Verification error:", error.message, "\n");
    }
  }
  
  console.log("=".repeat(50));
  console.log("🎉 Deployment complete!");
  console.log("=".repeat(50));
  console.log(`\nContract Address: ${address}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Explorer: ${getExplorerUrl(hre.network.name, address)}\n`);
}

/**
 * Get block explorer URL for the network
 * @param {string} networkName - Network name
 * @param {string} address - Contract address
 * @returns {string} Explorer URL
 */
function getExplorerUrl(networkName, address) {
  switch (networkName) {
    case "sepolia":
      return `https://sepolia.etherscan.io/address/${address}`;
    case "mainnet":
      return `https://etherscan.io/address/${address}`;
    case "goerli":
      return `https://goerli.etherscan.io/address/${address}`;
    case "polygon":
      return `https://polygonscan.com/address/${address}`;
    case "mumbai":
      return `https://mumbai.polygonscan.com/address/${address}`;
    default:
      return "Local network (no explorer)";
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
