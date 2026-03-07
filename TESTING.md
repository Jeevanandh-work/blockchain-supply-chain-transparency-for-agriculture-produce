# 🧪 Testing Guide - Blockchain Supply Chain

Complete testing guide for all components of the blockchain supply chain application.

## 📋 Table of Contents

1. [Smart Contract Testing](#smart-contract-testing)
2. [Backend API Testing](#backend-api-testing)
3. [Frontend Testing](#frontend-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Blockchain Verification](#blockchain-verification)

## 🔗 Smart Contract Testing

### Running Contract Tests

```bash
cd blockchain
npx hardhat test
```

### Expected Output

```
✅ SupplyChain Contract Tests
  ✓ Should deploy contract
  ✓ Should assign roles
  ✓ Should create batch
  ✓ Should transfer batch
  ✓ Should update status
  ✓ Should confirm delivery
  ✓ Should record quality
  ✓ Should get batch history
  ✓ Should emit events correctly

  9 passing (2s)
```

### Testing on Local Network

1. Start local Hardhat node:
```bash
npx hardhat node
```

2. Deploy contract:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

3. Interact via console:
```bash
npx hardhat console --network localhost
```

### Manual Contract Testing

```javascript
// In Hardhat console
const SupplyChain = await ethers.getContractFactory("SupplyChain");
const contract = await SupplyChain.attach("CONTRACT_ADDRESS");

// Create batch
await contract.createBatch("BATCH-001", "QmIPFSHash123");

// Get batch
const batch = await contract.getBatch("BATCH-001");
console.log(batch);

// Transfer batch
await contract.transferBatch("BATCH-001", "0xRecipientAddress", "Transferred");

// Update status
await contract.updateStatus("BATCH-001", "In Transit", "Mumbai");

// Confirm delivery
await contract.confirmDelivery("BATCH-001", "John Doe");
```

## 🖥️ Backend API Testing

### Unit Tests

```bash
cd backend
npm test
```

### Manual API Testing with cURL

**1. Health Check**
```bash
curl http://localhost:5000/api/health
```

**2. Register User**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Farmer",
    "email": "farmer@test.com",
    "password": "password123",
    "role": "farmer",
    "walletAddress": "0x1234567890123456789012345678901234567890"
  }'
```

**3. Login**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "farmer@test.com",
    "password": "password123"
  }'
```

**4. Create Batch (requires JWT token)**
```bash
curl -X POST http://localhost:5000/api/batch/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "batchId": "BATCH-001",
    "productName": "Organic Tomatoes",
    "quantity": "500",
    "unit": "kg",
    "harvestDate": "2024-01-15",
    "expiryDate": "2024-02-15",
    "farmLocation": "Maharashtra, India",
    "ipfsHash": "QmTestHash123",
    "certifications": ["Organic", "Sustainable"]
  }'
```

**5. Transfer Batch**
```bash
curl -X POST http://localhost:5000/api/batch/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "batchId": "BATCH-001",
    "toAddress": "0x9876543210987654321098765432109876543210",
    "location": "Mumbai Distribution Center",
    "statusMessage": "Transferred to distributor"
  }'
```

**6. Update Transport Status**
```bash
curl -X POST http://localhost:5000/api/batch/transport/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "batchId": "BATCH-001",
    "status": "In Transit",
    "location": "Highway 12, Mumbai",
    "latitude": 19.0760,
    "longitude": 72.8777
  }'
```

**7. Verify Batch on Blockchain (Public)**
```bash
curl http://localhost:5000/api/blockchain/verify/BATCH-001
```

**8. Get Transaction Details**
```bash
curl http://localhost:5000/api/blockchain/transaction/0xTransactionHash
```

**9. Get Network Info**
```bash
curl http://localhost:5000/api/blockchain/network
```

### Using Postman

1. Import collection from `postman/SupplyChain.postman_collection.json`
2. Set environment variables:
   - `baseUrl`: `http://localhost:5000/api`
   - `token`: (auto-set after login)
3. Run collection

### Testing with Thunder Client (VS Code)

1. Install Thunder Client extension
2. Import requests from `thunder-tests/`
3. Update environment
4. Run requests

## 🎨 Frontend Testing

### Component Tests

```bash
cd frontend
npm test
```

### E2E Tests with Cypress (if configured)

```bash
npm run test:e2e
```

### Manual Frontend Testing

**1. Farmer Dashboard**
- [ ] Login as farmer
- [ ] Create new batch
- [ ] Upload product image
- [ ] Verify IPFS upload
- [ ] Check QR code generation
- [ ] Verify blockchain transaction hash displayed
- [ ] View batch details

**2. Distributor Dashboard**
- [ ] Login as distributor
- [ ] View available batches from farmers
- [ ] Accept batch
- [ ] Verify blockchain transaction
- [ ] Transfer to transport partner
- [ ] Check ownership update

**3. Transport Dashboard**
- [ ] Login as transport partner
- [ ] View assigned batches
- [ ] Update status to "Picked Up"
- [ ] Verify GPS coordinates recorded
- [ ] Update status to "In Transit"
- [ ] Update status to "Reached Destination"
- [ ] Confirm delivery with proof upload
- [ ] Verify all blockchain transactions

**4. Retailer Dashboard**
- [ ] Login as retailer
- [ ] View inventory
- [ ] Perform quality inspection
- [ ] Grade product (A+/A/B)
- [ ] Record condition and freshness
- [ ] View batch journey timeline

**5. Consumer Dashboard (Public)**
- [ ] Access without login
- [ ] Search batch by ID
- [ ] Scan QR code
- [ ] View complete journey
- [ ] See farmer information
- [ ] **Verify blockchain section**
- [ ] Click transaction hashes
- [ ] Open Etherscan links
- [ ] View GPS tracking on map

## 🔄 Integration Testing

### Full Workflow Test

**Scenario: Tomato Batch from Farm to Consumer**

1. **Farmer Creates Batch**
   ```bash
   POST /api/batch/create
   Batch ID: TOMATO-2024-001
   Expected: ✅ Blockchain transaction, IPFS upload, QR generated
   ```

2. **Distributor Accepts**
   ```bash
   POST /api/batch/transfer
   To: Distributor wallet
   Expected: ✅ Blockchain transfer recorded, ownership updated
   ```

3. **Transport Picks Up**
   ```bash
   POST /api/batch/transport/status
   Status: "Picked Up"
   Expected: ✅ Blockchain status update, GPS recorded
   ```

4. **Transport In Transit**
   ```bash
   POST /api/batch/transport/status
   Status: "In Transit"
   Expected: ✅ Blockchain update, GPS trail
   ```

5. **Transport Delivers**
   ```bash
   POST /api/batch/transport/deliver
   Recipient: Retailer
   Expected: ✅ Blockchain delivery, IPFS proof, timestamp
   ```

6. **Retailer Inspects**
   ```bash
   POST /api/batch/quality
   Grade: A+
   Expected: ✅ Blockchain quality record
   ```

7. **Consumer Verifies**
   ```bash
   GET /api/blockchain/verify/TOMATO-2024-001
   Expected: ✅ Complete journey, all transaction hashes, verified badge
   ```

### Expected Results

- ✅ 6 blockchain transactions recorded
- ✅ 2 IPFS uploads (image + delivery proof)
- ✅ 1 QR code generated
- ✅ 4+ GPS coordinates recorded
- ✅ Complete ownership history
- ✅ Public verification success

## 🌐 Blockchain Verification

### Automated Verification Script

```bash
node scripts/verify-blockchain-integration.js
```

### Expected Output

```
╔════════════════════════════════════════════════════════════╗
║   BLOCKCHAIN SUPPLY CHAIN - INTEGRATION VERIFICATION      ║
╚════════════════════════════════════════════════════════════╝

🔍 Testing Smart Contract...
✅ Smart Contract exists
✅ Contract Artifact exists
✅ Function exists: createBatch
✅ Function exists: transferBatch
✅ Function exists: updateStatus
✅ Function exists: confirmDelivery
✅ Event exists: BatchCreated
✅ Event exists: StatusUpdated
✅ Event exists: BatchDelivered

🔍 Testing Blockchain Service...
✅ Blockchain Service exists
✅ Deployment Info exists

🔍 Testing Backend API...
✅ Health Check - Status: 200
✅ Blockchain Network Info - Status: 200
✅ Blockchain Controller exists
✅ Blockchain Routes exists

🔍 Testing Frontend Components...
✅ BlockchainBadge Component exists
✅ TransactionHashDisplay Component exists
✅ BlockchainVerification Component exists
✅ API method exists: verifyBatch
✅ API method exists: getTransaction

📊 BLOCKCHAIN INTEGRATION VERIFICATION REPORT
Total Tests: 45
✅ Passed: 45
❌ Failed: 0
⚠️  Warnings: 0
📈 Pass Rate: 100%

🎉 All critical tests passed! Blockchain integration is ready!
```

### Manual Blockchain Verification

**1. Check Contract Deployment**
```bash
cat backend/deployment.json
# Should show: address, network, deployer, timestamp
```

**2. Verify on Etherscan**
- Go to: https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS
- Check: Contract code verified ✅
- Check: Recent transactions visible
- Check: Events emitted correctly

**3. Test Transaction Recording**
```bash
# Create batch via API
curl -X POST http://localhost:5000/api/batch/create \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"batchId":"TEST-001",...}'

# Get batch from database
curl http://localhost:5000/api/batch/TEST-001

# Verify statusHistory contains blockchainHash
# Example: "blockchainHash": "0xabc123..."

# Check transaction on Etherscan
# https://sepolia.etherscan.io/tx/0xabc123...
```

**4. Verify Events Emission**
```javascript
// In Hardhat console or ethers.js script
const contract = await ethers.getContractAt("SupplyChain", CONTRACT_ADDRESS);

// Listen to events
contract.on("BatchCreated", (batchId, farmer, ipfsHash, timestamp) => {
  console.log("Batch Created:", batchId, farmer);
});

contract.on("StatusUpdated", (batchId, updatedBy, status, location, timestamp) => {
  console.log("Status Updated:", batchId, status, location);
});

contract.on("BatchDelivered", (batchId, deliveredBy, recipientName, timestamp) => {
  console.log("Batch Delivered:", batchId, recipientName);
});
```

## 📊 Performance Testing

### Load Testing with Artillery

```bash
npm install -g artillery

# Test batch creation endpoint
artillery quick --count 10 --num 100 http://localhost:5000/api/batch/all

# Custom scenario
artillery run load-test.yml
```

### Monitoring

- MongoDB queries performance
- Blockchain RPC response times
- IPFS upload speeds
- Frontend render times

## 🐛 Debugging Tips

### Smart Contract Issues

**Revert Errors:**
```bash
# Get detailed error with Hardhat
npx hardhat run scripts/debug.js --network localhost
```

**Gas Estimation:**
```javascript
const gasEstimate = await contract.estimateGas.createBatch(batchId, ipfsHash);
console.log("Gas needed:", gasEstimate.toString());
```

### Backend Issues

**MongoDB Connection:**
```bash
# Test connection
node -e "require('./backend/config/db')();"
```

**Blockchain Service:**
```javascript
// In backend console
const blockchainService = require('./backend/services/blockchainService');
blockchainService.initialize().then(() => {
  console.log("Initialized:", blockchainService.isReady());
});
```

### Frontend Issues

**React DevTools:**
- Install React Developer Tools extension
- Check component props and state
- Profile rendering performance

**Network Tab:**
- Check API requests
- Verify blockchain verification calls
- Monitor response times

## ✅ Test Checklist

Before deploying to production:

- [ ] All smart contract tests passing
- [ ] Backend API tests passing
- [ ] Frontend component tests passing
- [ ] Integration workflow completed successfully
- [ ] Blockchain verification script 100% pass rate
- [ ] Load testing shows acceptable performance
- [ ] Security audit completed
- [ ] Contract verified on Etherscan
- [ ] All environment variables configured
- [ ] Error handling tested (network failures, etc.)
- [ ] Cross-browser testing completed
- [ ] Mobile responsiveness verified

## 🚀 Continuous Integration

### GitHub Actions (Example)

```yaml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm run install-all
      - name: Compile contracts
        run: npm run compile
      - name: Run contract tests
        run: npm run test:contracts
      - name: Run backend tests
        run: npm run test:backend
      - name: Run integration verification
        run: npm run verify-integration
```

## 📞 Support

For testing issues:
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for setup instructions
- Review logs in `backend/logs/`
- Check blockchain explorer for transaction status
- Ensure testnet wallet has sufficient ETH

---

**Happy Testing! 🧪🌾**
