# ⚡ Quick Start Cheat Sheet

## 🚀 Installation (5 Minutes)

```bash
# 1. Install all dependencies
npm run install-all

# 2. Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp blockchain/.env.example blockchain/.env

# Edit .env files with your:
# - MongoDB URI
# - Infura Project ID
# - Private Key (testnet only!)
# - Pinata API keys
```

## 🔗 Deploy Smart Contract (2 Minutes)

### Option A: Local Development
```bash
# Terminal 1: Start local blockchain
cd blockchain
npx hardhat node

# Terminal 2: Deploy
npx hardhat run scripts/deploy.js --network localhost
```

### Option B: Sepolia Testnet
```bash
# Get testnet ETH: https://sepoliafaucet.com
cd blockchain
npx hardhat run scripts/deploy.js --network sepolia
```

## ▶️ Start Application (30 Seconds)

```bash
# Terminal 1: Backend (port 5000)
cd backend
npm run dev

# Terminal 2: Frontend (port 3000)
cd frontend
npm start
```

## 🧪 Quick Test

```bash
# Verify blockchain integration
node scripts/verify-blockchain-integration.js

# Expected: 100% pass rate ✅
```

## 📋 Create Your First Batch

### 1. Register as Farmer
- Go to: http://localhost:3000/register
- Fill details:
  - Name: `Test Farmer`
  - Email: `farmer@test.com`
  - Password: `password123`
  - Role: `Farmer`
  - Wallet: `0x1234...` (any testnet address)

### 2. Login
- Go to: http://localhost:3000/login
- Use credentials above

### 3. Create Batch
- Click "Create New Batch"
- Fill:
  - Product: `Organic Tomatoes`
  - Quantity: `500 kg`
  - Harvest Date: Today
  - Location: Your city
- Click "Create"
- ✅ **See blockchain transaction hash!**

### 4. Verify on Blockchain
- Go to: http://localhost:3000/consumer
- Enter your batch ID
- ✅ **See "Verified on Blockchain" badge!**

## 🔍 API Endpoints Cheat Sheet

```bash
# Health check
curl http://localhost:5000/api/health

# Get blockchain network info (PUBLIC)
curl http://localhost:5000/api/blockchain/network

# Verify batch on blockchain (PUBLIC)
curl http://localhost:5000/api/blockchain/verify/BATCH-001

# Get transaction details (PUBLIC)
curl http://localhost:5000/api/blockchain/transaction/0xTransactionHash

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"farmer@test.com","password":"password123"}'

# Create batch (needs token)
curl -X POST http://localhost:5000/api/batch/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "batchId":"BATCH-001",
    "productName":"Tomatoes",
    "quantity":"500",
    "unit":"kg"
  }'
```

## 📱 Frontend Routes

- `/login` - Login page
- `/register` - Registration
- `/dashboard` - Role-based dashboard redirect
- `/consumer` - Public batch verification (no login)
- `/batch/:id` - Batch details

## 🎨 Use Blockchain Components

```jsx
import BlockchainBadge from './components/BlockchainBadge';
import TransactionHashDisplay from './components/TransactionHashDisplay';
import BlockchainVerification from './components/BlockchainVerification';

// Show verified badge
<BlockchainBadge verified={true} size="md" />

// Show transaction hash with copy & explorer link
<TransactionHashDisplay 
  txHash="0xabc123..." 
  label="Transaction Hash"
/>

// Show full verification panel
<BlockchainVerification batchId="BATCH-001" />
```

## 🛠️ Common Commands

```bash
# Compile smart contracts
cd blockchain && npx hardhat compile

# Run contract tests
cd blockchain && npx hardhat test

# Clean and rebuild
cd blockchain && npx hardhat clean && npx hardhat compile

# Check MongoDB connection
node -e "require('./backend/config/db')()"

# Install missing package
cd backend && npm install package-name
cd frontend && npm install package-name

# Check logs
tail -f backend/logs/app.log
```

## 🐛 Troubleshooting

### "Blockchain service not initialized"
```bash
# Check deployment.json exists
ls backend/deployment.json

# If missing, deploy contract
cd blockchain && npx hardhat run scripts/deploy.js --network localhost
```

### "Transaction failed"
```bash
# Check you have testnet ETH
# Get from: https://sepoliafaucet.com

# Check private key in .env
echo $PRIVATE_KEY
```

### "MongoDB connection failed"
```bash
# Check MONGODB_URI in backend/.env
# Ensure IP is whitelisted in MongoDB Atlas
```

### "Contract not found"
```bash
# Ensure contract is deployed
cat backend/deployment.json

# Check contract address matches in .env
```

## 📊 Verify Deployment

```bash
# 1. Check all files exist
ls backend/deployment.json
ls frontend/src/contracts/SupplyChain.json
ls blockchain/artifacts/contracts/SupplyChain.sol/SupplyChain.json

# 2. Run verification script
node scripts/verify-blockchain-integration.js

# 3. Check backend health
curl http://localhost:5000/api/health

# 4. Check blockchain network
curl http://localhost:5000/api/blockchain/network

# Expected output:
# {
#   "success": true,
#   "network": {
#     "name": "sepolia",
#     "chainId": "11155111",
#     "contractAddress": "0x...",
#     "initialized": true
#   }
# }
```

## 🎯 Next Steps

1. ✅ Create test users for all roles (Farmer, Distributor, Transport, Retailer)
2. ✅ Create a batch as Farmer
3. ✅ Accept batch as Distributor
4. ✅ Update status as Transport
5. ✅ Verify as Consumer
6. ✅ Check all transactions on Etherscan

## 📚 Full Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide
- [TESTING.md](TESTING.md) - Testing instructions
- [BLOCKCHAIN_INTEGRATION_SUMMARY.md](BLOCKCHAIN_INTEGRATION_SUMMARY.md) - Feature summary
- [README.md](README.md) - Project overview

## 🔐 Environment Variables Quick Reference

### Backend (.env)
```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_here
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/PROJECT_ID
PRIVATE_KEY=your_private_key_without_0x
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_API_KEY=your_pinata_secret
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### Blockchain (.env)
```env
INFURA_PROJECT_ID=your_infura_project_id
PRIVATE_KEY=your_private_key_without_0x
ETHERSCAN_API_KEY=your_etherscan_key
```

## 🎉 Success Indicators

✅ Hardhat node running (Terminal 1)
✅ Backend server running on :5000 (Terminal 2)
✅ Frontend running on :3000 (Terminal 3)
✅ Contract deployed (deployment.json exists)
✅ MongoDB connected
✅ Blockchain service initialized
✅ Can create batch and see transaction hash
✅ Can verify batch on consumer page

## 💡 Pro Tips

- Use Sepolia testnet for realistic testing
- Keep private keys in .env, NEVER commit
- Get free Sepolia ETH from multiple faucets
- Monitor transactions on Sepolia Etherscan
- Use mock transactions for offline development
- Check blockchain service logs for debugging
- Use verification script after any changes

## 📞 Quick Help

**Issue:** Contract deployment fails
**Fix:** Ensure you have testnet ETH and correct RPC URL

**Issue:** Frontend can't connect to backend
**Fix:** Check REACT_APP_API_URL in frontend/.env

**Issue:** Blockchain verification shows "not verified"
**Fix:** Ensure contract deployed and transaction confirmed

**Issue:** MongoDB connection timeout
**Fix:** Whitelist your IP in MongoDB Atlas

---

**⚡ You're all set! Happy farming! 🌾**
