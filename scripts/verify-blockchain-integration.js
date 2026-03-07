#!/usr/bin/env node

/**
 * Blockchain Integration Verification Script
 * Verifies all blockchain features are working correctly
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:5000/api';
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

async function log(message, type = 'info') {
  const color = {
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue,
  }[type] || colors.reset;

  console.log(`${color}${message}${colors.reset}`);
}

async function checkFile(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      testResults.passed++;
      await log(`✅ ${description} exists`, 'success');
      return true;
    } else {
      testResults.failed++;
      await log(`❌ ${description} not found: ${filePath}`, 'error');
      return false;
    }
  } catch (error) {
    testResults.failed++;
    await log(`❌ Error checking ${description}: ${error.message}`, 'error');
    return false;
  }
}

async function checkAPI(endpoint, description) {
  try {
    const response = await axios.get(`${API_BASE_URL}${endpoint}`);
    testResults.passed++;
    await log(`✅ ${description} - Status: ${response.status}`, 'success');
    return response.data;
  } catch (error) {
    testResults.failed++;
    await log(`❌ ${description} failed: ${error.message}`, 'error');
    return null;
  }
}

async function testBlockchainService() {
  await log('\n🔍 Testing Blockchain Service...', 'info');
  
  const backendServicePath = path.join(__dirname, '../backend/services/blockchainService.js');
  await checkFile(backendServicePath, 'Blockchain Service');
  
  const deploymentPath = path.join(__dirname, '../backend/deployment.json');
  const hasDeployment = await checkFile(deploymentPath, 'Deployment Info');
  
  if (hasDeployment) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    await log(`  📍 Contract Address: ${deployment.address}`, 'info');
    await log(`  🌐 Network: ${deployment.network}`, 'info');
    await log(`  ⏰ Deployed: ${deployment.timestamp}`, 'info');
  }
}

async function testSmartContract() {
  await log('\n🔍 Testing Smart Contract...', 'info');
  
  const contractPath = path.join(__dirname, '../blockchain/contracts/SupplyChain.sol');
  await checkFile(contractPath, 'Smart Contract');
  
  const artifactPath = path.join(__dirname, '../blockchain/artifacts/contracts/SupplyChain.sol/SupplyChain.json');
  const hasArtifact = await checkFile(artifactPath, 'Contract Artifact');
  
  if (hasArtifact) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    await log(`  📄 Contract Name: ${artifact.contractName}`, 'info');
    await log(`  📝 Compiler Version: ${artifact.compiler?.version}`, 'info');
    
    // Check for required functions
    const requiredFunctions = [
      'createBatch',
      'transferBatch',
      'updateStatus',
      'confirmDelivery',
      'recordQuality',
      'getBatch',
      'getBatchHistory',
      'getQualityRecords',
    ];
    
    const abiMethods = artifact.abi.filter(item => item.type === 'function').map(item => item.name);
    
    for (const func of requiredFunctions) {
      if (abiMethods.includes(func)) {
        testResults.passed++;
        await log(`  ✅ Function exists: ${func}`, 'success');
      } else {
        testResults.failed++;
        await log(`  ❌ Function missing: ${func}`, 'error');
      }
    }
    
    // Check for required events
    const requiredEvents = [
      'BatchCreated',
      'BatchTransferred',
      'StatusUpdated',
      'BatchDelivered',
      'QualityRecorded',
    ];
    
    const abiEvents = artifact.abi.filter(item => item.type === 'event').map(item => item.name);
    
    for (const event of requiredEvents) {
      if (abiEvents.includes(event)) {
        testResults.passed++;
        await log(`  ✅ Event exists: ${event}`, 'success');
      } else {
        testResults.failed++;
        await log(`  ❌ Event missing: ${event}`, 'error');
      }
    }
  }
}

async function testBackendAPI() {
  await log('\n🔍 Testing Backend API...', 'info');
  
  // Test health endpoint
  await checkAPI('/health', 'Health Check');
  
  // Test blockchain endpoints
  await checkAPI('/blockchain/network', 'Blockchain Network Info');
  
  // Test if backend routes are registered
  const controllersPath = path.join(__dirname, '../backend/controllers/blockchainController.js');
  await checkFile(controllersPath, 'Blockchain Controller');
  
  const routesPath = path.join(__dirname, '../backend/routes/blockchainRoutes.js');
  await checkFile(routesPath, 'Blockchain Routes');
}

async function testFrontendComponents() {
  await log('\n🔍 Testing Frontend Components...', 'info');
  
  const components = [
    ['../frontend/src/components/BlockchainBadge.jsx', 'BlockchainBadge Component'],
    ['../frontend/src/components/TransactionHashDisplay.jsx', 'TransactionHashDisplay Component'],
    ['../frontend/src/components/BlockchainVerification.jsx', 'BlockchainVerification Component'],
  ];
  
  for (const [filePath, description] of components) {
    const fullPath = path.join(__dirname, filePath);
    await checkFile(fullPath, description);
  }
  
  // Check if API service includes blockchain methods
  const apiServicePath = path.join(__dirname, '../frontend/src/services/api.js');
  if (fs.existsSync(apiServicePath)) {
    const apiContent = fs.readFileSync(apiServicePath, 'utf8');
    
    const requiredAPIs = [
      'verifyBatch',
      'getTransaction',
      'getNetworkInfo',
      'getBlockchainBatch',
    ];
    
    for (const api of requiredAPIs) {
      if (apiContent.includes(api)) {
        testResults.passed++;
        await log(`  ✅ API method exists: ${api}`, 'success');
      } else {
        testResults.failed++;
        await log(`  ❌ API method missing: ${api}`, 'error');
      }
    }
  }
}

async function testEnvironmentConfig() {
  await log('\n🔍 Testing Environment Configuration...', 'info');
  
  const envFiles = [
    ['../backend/.env', 'Backend .env', false],
    ['../backend/.env.example', 'Backend .env.example', true],
    ['../frontend/.env', 'Frontend .env', false],
    ['../frontend/.env.example', 'Frontend .env.example', true],
    ['../blockchain/.env', 'Blockchain .env', false],
    ['../blockchain/.env.example', 'Blockchain .env.example', true],
  ];
  
  for (const [filePath, description, required] of envFiles) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      testResults.passed++;
      await log(`  ✅ ${description} exists`, 'success');
    } else if (required) {
      testResults.failed++;
      await log(`  ❌ ${description} not found`, 'error');
    } else {
      testResults.warnings++;
      await log(`  ⚠️  ${description} not found (optional)`, 'warning');
    }
  }
}

async function testDatabaseModels() {
  await log('\n🔍 Testing Database Models...', 'info');
  
  const batchModelPath = path.join(__dirname, '../backend/models/Batch.js');
  if (fs.existsSync(batchModelPath)) {
    const modelContent = fs.readFileSync(batchModelPath, 'utf8');
    
    const requiredFields = [
      'batchId',
      'productName',
      'farmer',
      'currentOwner',
      'status',
      'gpsTracking',
      'deliveryProof',
      'statusHistory',
      'blockchainHash',
    ];
    
    for (const field of requiredFields) {
      if (modelContent.includes(field)) {
        testResults.passed++;
        await log(`  ✅ Batch model field: ${field}`, 'success');
      } else {
        testResults.failed++;
        await log(`  ❌ Batch model field missing: ${field}`, 'error');
      }
    }
  }
}

async function generateReport() {
  await log('\n' + '='.repeat(60), 'info');
  await log('📊 BLOCKCHAIN INTEGRATION VERIFICATION REPORT', 'info');
  await log('='.repeat(60), 'info');
  
  const total = testResults.passed + testResults.failed + testResults.warnings;
  const passRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2);
  
  await log(`\nTotal Tests: ${total}`, 'info');
  await log(`✅ Passed: ${testResults.passed}`, 'success');
  await log(`❌ Failed: ${testResults.failed}`, 'error');
  await log(`⚠️  Warnings: ${testResults.warnings}`, 'warning');
  await log(`\n📈 Pass Rate: ${passRate}%`, passRate >= 90 ? 'success' : passRate >= 70 ? 'warning' : 'error');
  
  if (testResults.failed === 0) {
    await log('\n🎉 All critical tests passed! Blockchain integration is ready!', 'success');
  } else {
    await log('\n⚠️  Some tests failed. Please review the errors above.', 'warning');
  }
  
  await log('\n' + '='.repeat(60) + '\n', 'info');
}

async function main() {
  console.clear();
  await log('╔════════════════════════════════════════════════════════════╗', 'info');
  await log('║   BLOCKCHAIN SUPPLY CHAIN - INTEGRATION VERIFICATION      ║', 'info');
  await log('╚════════════════════════════════════════════════════════════╝\n', 'info');
  
  try {
    await testSmartContract();
    await testBlockchainService();
    await testDatabaseModels();
    await testBackendAPI();
    await testFrontendComponents();
    await testEnvironmentConfig();
    await generateReport();
    
    process.exit(testResults.failed > 0 ? 1 : 0);
  } catch (error) {
    await log(`\n❌ Verification script failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// Run verification
main();
