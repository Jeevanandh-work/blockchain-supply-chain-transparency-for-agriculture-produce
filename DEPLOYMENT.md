# 🌾 Blockchain-Based Supply Chain Transparency for Agricultural Produce

A complete blockchain-powered agricultural supply chain transparency platform with role-based dashboards, real-time tracking, and Ethereum verification.

## ✨ Features

### 🔗 Blockchain Integration
- **Smart Contract**: Solidity ^0.8.20 with comprehensive event emissions
- **Ethereum Testnet**: Sepolia testnet support via Infura
- **Transaction Recording**: All supply chain actions recorded on blockchain
- **Verification**: Public verification of batch authenticity
- **Event Tracking**: StatusUpdated, BatchTransferred, BatchDelivered, QualityRecorded

### 👥 Role-Based Dashboards
1. **Farmer Dashboard**
   - Create batches with product details
   - Upload to IPFS
   - Generate QR codes
   - View blockchain verification

2. **Distributor Dashboard**
   - Accept batches from farmers
   - Transfer to transport partners
   - Blockchain transaction triggers
   - Ownership tracking

3. **Transport Dashboard**
   - Real-time GPS tracking
   - Status updates (Picked Up, In Transit, Reached Destination)
   - Delivery confirmation with proof upload
   - Blockchain-verified deliveries

4. **Retailer Dashboard**
   - Inventory management
   - Quality inspection with grading
   - Sales tracking
   - Consumer engagement metrics

5. **Consumer Dashboard**
   - Public batch tracking by ID/QR
   - Complete journey visualization
   - Farmer information & certifications
   - **Blockchain verification section**
   - Transaction hash display with explorer links

### 🛠️ Technical Stack

**Blockchain**
- Solidity ^0.8.20
- Hardhat development environment
- Ethers.js v6
- OpenZeppelin contracts

**Backend**
- Node.js & Express.js
- MongoDB Atlas
- JWT authentication
- IPFS integration (Pinata)
- QR code generation
- Role-based access control (RBAC)

**Frontend**
- React 18.2
- Tailwind CSS
- Framer Motion animations
- Lucide icons
- Chart.js for analytics
- Responsive design

## 📦 Installation

### Prerequisites
```bash
Node.js >= 16.x
MongoDB Atlas account
Infura account (for Ethereum RPC)
Pinata account (for IPFS)
MetaMask or similar Web3 wallet
```

### 1. Clone Repository
```bash
git clone <repository-url>
cd "Blockchain-Based Supply Chain Transparency for Agricultural Produce"
```

### 2. Install Dependencies

**Blockchain**
```bash
cd blockchain
npm install
```

**Backend**
```bash
cd ../backend
npm install
```

**Frontend**
```bash
cd ../frontend
npm install
```

### 3. Environment Configuration

**Backend (.env)**
```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/supplychain?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRE=7d

# Blockchain
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
PRIVATE_KEY=your_ethereum_private_key_here

# IPFS (Pinata)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_key

# Optional: Admin wallet address
ADMIN_WALLET_ADDRESS=0xYourAdminWalletAddress
```

**Frontend (.env)**
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_CONTRACT_ADDRESS=will_be_auto_filled_after_deployment
```

**Blockchain (.env)**
```env
INFURA_PROJECT_ID=your_infura_project_id
PRIVATE_KEY=your_ethereum_private_key_for_deployment
ETHERSCAN_API_KEY=your_etherscan_api_key_for_verification
```

### 4. Deploy Smart Contract

**Local Development (Hardhat Network)**
```bash
cd blockchain

# Start local Ethereum node
npx hardhat node

# In another terminal, deploy
npx hardhat run scripts/deploy.js --network localhost
```

**Sepolia Testnet**
```bash
cd blockchain

# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Contract will be automatically verified on Etherscan
```

Deployment script will automatically:
- ✅ Deploy SupplyChain contract
- ✅ Save deployment info to `deployment.json`
- ✅ Copy ABI to frontend (`frontend/src/contracts/SupplyChain.json`)
- ✅ Copy deployment info to backend
- ✅ Assign test roles (localhost only)
- ✅ Create test batch (localhost only)
- ✅ Verify contract on Etherscan (testnet)

### 5. Start Backend Server
```bash
cd backend
npm run dev
```

Backend will:
- Connect to MongoDB
- Initialize blockchain service
- Load deployed contract
- Start API server on port 5000

### 6. Start Frontend
```bash
cd frontend
npm start
```

Frontend will open at `http://localhost:3000`

## 🚀 Usage

### Register Users
1. Navigate to `/register`
2. Create accounts with roles:
   - **Farmer**: Create batches
   - **Distributor**: Accept from farmers
   - **Transport**: Delivery operations
   - **Retailer**: Inventory management
   - **Consumer**: Track products

### Create a Batch (Farmer)
1. Login as Farmer
2. Click "Create New Batch"
3. Fill product details:
   - Product name
   - Quantity
   - Harvest date
   - Farm location
   - Certifications
4. Upload product image (stored on IPFS)
5. Submit → **Blockchain transaction triggered**
6. QR code generated automatically

### Transfer Batch (Distributor)
1. Login as Distributor
2. View "Available Batches" from farmers
3. Click "Accept Batch"
4. Enter:
   - Current location
   - Transfer notes
5. Confirm → **Blockchain transaction recorded**

### Update Transport Status (Transport Partner)
1. Login as Transport
2. View assigned batches
3. Click "Update Status"
4. Select status:
   - Picked Up
   - In Transit
   - Reached Destination
   - Delivered
5. Enter GPS coordinates (auto-detected)
6. Submit → **Blockchain transaction recorded**

### Confirm Delivery
1. In Transport Dashboard
2. Click "Confirm Delivery"
3. Upload delivery proof image
4. Enter recipient name & signature
5. Submit → **Blockchain transaction + IPFS upload**

### Track Product (Consumer)
1. Navigate to Consumer Dashboard (no login required)
2. Enter Batch ID or scan QR code
3. View:
   - Complete journey timeline
   - Farmer information
   - Current location
   - **Blockchain verification ✅**
   - Transaction hashes with explorer links
   - GPS tracking history

## 🔍 Blockchain Verification

### Verify Batch on Blockchain
```bash
GET /api/blockchain/verify/:batchId
```

Response:
```json
{
  "success": true,
  "verified": true,
  "batch": { ... },
  "blockchain": {
    "verified": true,
    "contractAddress": "0x...",
    "network": {
      "name": "sepolia",
      "chainId": "11155111"
    },
    "transactionHashes": [
      {
        "status": "Created",
        "transactionHash": "0x...",
        "timestamp": 1234567890
      }
    ],
    "ownershipHistory": ["0x...", "0x..."],
    "qualityRecords": [...]
  }
}
```

### View Transaction on Explorer
All transaction hashes link to:
- **Sepolia**: https://sepolia.etherscan.io/tx/0x...
- **Mainnet**: https://etherscan.io/tx/0x...

## 🧪 Testing

### Smart Contract Tests
```bash
cd blockchain
npx hardhat test
```

### API Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Batches
- `POST /api/batch/create` - Create batch (Farmer)
- `GET /api/batch/all` - Get all batches
- `GET /api/batch/:id` - Get batch details
- `POST /api/batch/transfer` - Transfer batch
- `POST /api/batch/quality` - Record quality inspection

### Transport
- `POST /api/batch/transport/status` - Update transport status
- `POST /api/batch/transport/deliver` - Confirm delivery
- `GET /api/batch/:id/tracking` - Get GPS tracking (Public)

### Blockchain Verification
- `GET /api/blockchain/verify/:batchId` - Verify batch (Public)
- `GET /api/blockchain/transaction/:txHash` - Get transaction details (Public)
- `GET /api/blockchain/network` - Get network info (Public)
- `GET /api/blockchain/batches` - Get all verified batches
- `POST /api/blockchain/verify-multiple` - Verify multiple batches

## 🎨 Frontend Components

### Blockchain Components
- **`<BlockchainBadge />`** - Verified badge with animation
- **`<TransactionHashDisplay />`** - Hash with copy & explorer link
- **`<BlockchainVerification />`** - Complete verification panel

Usage:
```jsx
import { BlockchainVerification } from '../components/BlockchainVerification';

<BlockchainVerification batchId="BATCH-001" />
```

## 🔐 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Helmet.js security headers
- Rate limiting (100 req/15min)
- MongoDB injection protection
- CORS configuration
- Private key encryption
- Smart contract access modifiers

## 📊 Smart Contract Functions

### Read Functions
- `getBatch(batchId)` - Get batch details
- `getBatchHistory(batchId)` - Get ownership history
- `getQualityRecords(batchId)` - Get quality inspections
- `batchExistsCheck(batchId)` - Check if batch exists

### Write Functions (Transaction Required)
- `createBatch(batchId, ipfsHash)` - Create new batch
- `transferBatch(batchId, toAddress, statusMsg)` - Transfer ownership
- `updateStatus(batchId, status, location)` - Update transport status
- `confirmDelivery(batchId, recipientName)` - Confirm delivery
- `recordQuality(batchId, qualityHash)` - Record quality inspection
- `assignRole(userAddress, role)` - Assign user role (Admin)

### Events
- `BatchCreated(batchId, farmer, ipfsHash, timestamp)`
- `BatchTransferred(batchId, from, to, timestamp)`
- `StatusUpdated(batchId, updatedBy, status, location, timestamp)`
- `BatchDelivered(batchId, deliveredBy, recipientName, timestamp)`
- `QualityRecorded(batchId, qualityHash, recordedBy, timestamp)`

## 🌐 Deployment to Production

### Backend (Heroku/Railway)
```bash
# Install Heroku CLI
heroku create agrichain-backend

# Set environment variables
heroku config:set MONGODB_URI=...
heroku config:set JWT_SECRET=...
heroku config:set BLOCKCHAIN_RPC_URL=...
heroku config:set PRIVATE_KEY=...

# Deploy
git push heroku main
```

### Frontend (Vercel/Netlify)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod
```

### Smart Contract (Ethereum Mainnet)
```bash
cd blockchain

# IMPORTANT: Use mainnet with caution
# Ensure PRIVATE_KEY has sufficient ETH
npx hardhat run scripts/deploy.js --network mainnet
```

## 📝 Environment Variables Summary

| Variable | Location | Required | Description |
|----------|----------|----------|-------------|
| `MONGODB_URI` | Backend | ✅ | MongoDB connection string |
| `JWT_SECRET` | Backend | ✅ | JWT signing secret |
| `BLOCKCHAIN_RPC_URL` | Backend | ✅ | Ethereum RPC endpoint |
| `PRIVATE_KEY` | Backend | ✅ | Deployer private key |
| `PINATA_API_KEY` | Backend | ✅ | IPFS API key |
| `PINATA_SECRET_API_KEY` | Backend | ✅ | IPFS secret key |
| `REACT_APP_API_URL` | Frontend | ✅ | Backend API URL |
| `INFURA_PROJECT_ID` | Blockchain | ✅ | Infura project ID |
| `ETHERSCAN_API_KEY` | Blockchain | ⚠️ | For contract verification |

## 🐛 Troubleshooting

### Blockchain service not initialized
```bash
# Check deployment.json exists in backend folder
ls backend/deployment.json

# Verify contract address is correct
cat backend/deployment.json

# Ensure RPC URL is accessible
curl https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

### Frontend can't connect to backend
```bash
# Check REACT_APP_API_URL in frontend/.env
echo $REACT_APP_API_URL

# Ensure backend is running
curl http://localhost:5000/api/health
```

### Transaction fails
- Ensure wallet has sufficient testnet ETH
- Get Sepolia ETH from faucet: https://sepoliafaucet.com/
- Check gas price settings in Hardhat config
- Verify private key has correct permissions

## 📚 Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js v6 Guide](https://docs.ethers.org/v6/)
- [Solidity Documentation](https://docs.soliditylang.org/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [MongoDB Atlas](https://www.mongodb.com/docs/atlas/)
- [IPFS & Pinata](https://docs.pinata.cloud/)

## 👨‍💻 Development Team

Built with ❤️ by the AgriChain team

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please follow these steps:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📧 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Email: support@agrichain.example.com

---

**⚠️ Important Notes:**
- Never commit `.env` files or private keys to version control
- Always use testnet for development
- Audit smart contracts before mainnet deployment
- Keep dependencies updated for security
- Use hardware wallet for production deployments

**🎉 Happy Farming! 🌾**
