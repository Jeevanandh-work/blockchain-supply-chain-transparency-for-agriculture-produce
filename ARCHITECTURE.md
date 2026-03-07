# 🏗️ System Architecture - AgriChain Platform

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AGRICHAIN PLATFORM                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   BLOCKCHAIN    │    │     BACKEND      │    │     FRONTEND        │
│   (Ethereum)    │◄──►│   (Express.js)   │◄──►│     (React)         │
│                 │    │                  │    │                     │
│  - Smart        │    │  - REST API      │    │  - Dashboards       │
│    Contract     │    │  - MongoDB       │    │  - Components       │
│  - Events       │    │  - IPFS Service  │    │  - Verification UI  │
│  - Verification │    │  - QR Service    │    │  - Animations       │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
        │                      │                         │
        │                      │                         │
        ▼                      ▼                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  Sepolia        │    │  MongoDB Atlas   │    │  Users (5 Roles)    │
│  Testnet        │    │  IPFS (Pinata)   │    │  - Farmer           │
│  Etherscan      │    │  JWT Auth        │    │  - Distributor      │
└─────────────────┘    └──────────────────┘    │  - Transport        │
                                                │  - Retailer         │
                                                │  - Consumer         │
                                                └─────────────────────┘
```

## 🔄 Data Flow

### 1. Batch Creation Flow

```
[Farmer Dashboard]
      │
      │ 1. Fill batch form
      │ 2. Upload image
      ▼
[Frontend]
      │
      │ POST /api/batch/create
      ▼
[Backend API]
      │
      ├─► 3. Upload to IPFS → Get hash
      │
      ├─► 4. Generate QR code
      │
      ├─► 5. Call blockchainService.createBatch()
      │        │
      │        ▼
      │   [Ethers.js]
      │        │
      │        │ 6. Sign transaction
      │        ▼
      │   [Smart Contract]
      │        │
      │        │ 7. Emit BatchCreated event
      │        │ 8. Store on blockchain
      │        ▼
      │   Return transaction hash
      │
      ├─► 9. Save to MongoDB (with txHash)
      │
      ▼
Return to Frontend
      │
      │ 10. Show success + txHash
      │ 11. Display QR code
      │ 12. Show blockchain badge ✅
      ▼
[Farmer sees confirmation]
```

### 2. Transport Status Update Flow

```
[Transport Dashboard]
      │
      │ 1. Click "Update Status"
      │ 2. Select status (In Transit)
      │ 3. Enter GPS coordinates
      ▼
[Frontend]
      │
      │ POST /api/batch/transport/status
      ▼
[Backend API]
      │
      │ Verify transport role
      ├─► Call blockchainService.updateBatchStatus()
      │        │
      │        ▼
      │   [Smart Contract]
      │        │
      │        │ Emit StatusUpdated event
      │        ▼
      │   Return transaction hash
      │
      ├─► Update MongoDB
      │   - Add to gpsTracking[]
      │   - Add to statusHistory[]
      │   - Store txHash
      │
      ▼
Return to Frontend
      │
      │ Show transaction hash
      │ Toast notification
      │ Update batch table
      ▼
[Transport sees update]
```

### 3. Consumer Verification Flow

```
[Consumer Dashboard]
      │
      │ 1. Enter Batch ID or scan QR
      ▼
[Frontend]
      │
      │ GET /api/blockchain/verify/BATCH-001
      ▼
[Backend API]
      │
      ├─► Fetch from MongoDB
      │
      ├─► Call blockchainService.getBatch()
      │        │
      │        ▼
      │   [Smart Contract - Read]
      │        │
      │        ▼
      │   Return blockchain data
      │
      ├─► Call blockchainService.getBatchHistory()
      │
      ├─► Call blockchainService.getQualityRecords()
      │
      ├─► Combine all data
      │
      ▼
Return comprehensive verification
      │
      ▼
[BlockchainVerification Component]
      │
      ├─► Network info
      ├─► All transaction hashes
      ├─► Ownership history
      ├─► Quality records
      ├─► GPS tracking
      ├─► Etherscan links
      │
      ▼
[Consumer sees complete journey ✅]
```

## 🗄️ Database Schema

### Batch Collection (MongoDB)

```javascript
{
  _id: ObjectId,
  batchId: "BATCH-2024-001",
  productName: "Organic Tomatoes",
  farmer: ObjectId (User),
  currentOwner: ObjectId (User),
  quantity: "500",
  unit: "kg",
  harvestDate: Date,
  expiryDate: Date,
  farmLocation: "Maharashtra, India",
  location: "Mumbai Distribution Center",
  status: "In Transit",
  
  // IPFS
  ipfsHash: "QmHashABC123...",
  qrCode: "data:image/png;base64,...",
  
  // GPS Tracking
  gpsTracking: [
    {
      latitude: 19.0760,
      longitude: 72.8777,
      location: "Highway 12, Mumbai",
      timestamp: Date
    }
  ],
  
  // Status History with Blockchain
  statusHistory: [
    {
      status: "Created",
      message: "Batch created by farmer",
      location: "Farm, Maharashtra",
      updatedBy: ObjectId (User),
      blockchainHash: "0xabc123...", // ← Transaction hash
      timestamp: Date
    },
    {
      status: "In Transit",
      message: "Picked up by transport",
      location: "Mumbai",
      updatedBy: ObjectId (User),
      blockchainHash: "0xdef456...",
      timestamp: Date
    }
  ],
  
  // Delivery Proof
  deliveryProof: {
    recipientName: "Retailer Name",
    signature: "signature_data",
    notes: "Delivered in good condition",
    proofIpfsHash: "QmDeliveryProof...",
    deliveredBy: ObjectId (User),
    deliveredAt: Date
  },
  
  deliveredAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### User Collection

```javascript
{
  _id: ObjectId,
  name: "Test Farmer",
  email: "farmer@test.com",
  password: "hashed_password",
  role: "farmer", // farmer | distributor | transport | retailer | consumer
  walletAddress: "0x1234567890...",
  createdAt: Date,
  updatedAt: Date
}
```

## 🔗 Smart Contract Storage

### On-Chain Data Structure

```solidity
struct Batch {
    string batchId;
    address farmer;
    address currentOwner;
    string ipfsHash;
    string[] statusUpdates;
    uint256 createdAt;
    uint256 updatedAt;
}

struct QualityRecord {
    string qualityHash; // IPFS hash
    address recordedBy;
    uint256 timestamp;
}

// Mappings
mapping(string => Batch) public batches;
mapping(string => address[]) public batchHistory;
mapping(string => QualityRecord[]) public qualityRecords;
```

## 🌐 API Architecture

### REST API Endpoints

```
Authentication
├── POST   /api/auth/register
├── POST   /api/auth/login
└── GET    /api/auth/me

Batch Management
├── POST   /api/batch/create (Farmer)
├── GET    /api/batch/all
├── GET    /api/batch/:id
├── POST   /api/batch/transfer (Distributor)
├── POST   /api/batch/quality (Retailer)
├── GET    /api/batch/my-batches
└── GET    /api/batch/:id/tracking (Public)

Transport Operations
├── POST   /api/batch/transport/status (Transport)
└── POST   /api/batch/transport/deliver (Transport)

Blockchain Verification (Public)
├── GET    /api/blockchain/verify/:batchId
├── GET    /api/blockchain/transaction/:txHash
├── GET    /api/blockchain/network
├── GET    /api/blockchain/batch/:batchId
├── GET    /api/blockchain/batches
└── POST   /api/blockchain/verify-multiple

User Management
├── GET    /api/user/profile
├── PUT    /api/user/profile
└── GET    /api/user/all (Admin)

Health Check
└── GET    /api/health
```

## 🎨 Frontend Components

### Component Hierarchy

```
App
├── AuthContext (Global State)
├── Routes
│   ├── PublicRoutes
│   │   ├── Login
│   │   ├── Register
│   │   └── ConsumerDashboard (No auth required)
│   │
│   └── PrivateRoutes (Auth required)
│       ├── FarmerDashboard
│       │   ├── BatchCard
│       │   ├── CreateBatchModal
│       │   ├── QRDisplay
│       │   └── BlockchainBadge
│       │
│       ├── DistributorDashboard
│       │   ├── BatchCard
│       │   ├── TransferModal
│       │   └── TransactionHashDisplay
│       │
│       ├── TransportDashboard
│       │   ├── BatchTable
│       │   ├── StatusUpdateModal
│       │   ├── DeliveryConfirmationModal
│       │   ├── NotificationsPanel
│       │   └── BlockchainVerification
│       │
│       ├── RetailerDashboard
│       │   ├── InventoryGrid
│       │   ├── QualityInspectionModal
│       │   ├── ProductDetailsModal
│       │   └── StatusTimeline
│       │
│       └── BatchDetails
│           ├── ProgressTracker
│           ├── StatusTimeline
│           └── BlockchainVerification

Shared Components
├── Navbar
├── Modal
├── Button
├── Card
├── LoadingSpinner
├── BlockchainBadge
├── TransactionHashDisplay
└── BlockchainVerification
```

## 🔐 Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1: Network Security                          │
│  - HTTPS/SSL                                        │
│  - CORS Configuration                               │
│  - Rate Limiting (100 req/15min)                    │
│  - Helmet.js Headers                                │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 2: Authentication                            │
│  - JWT Tokens                                       │
│  - Bcrypt Password Hashing                          │
│  - Token Expiration (7 days)                        │
│  - Private Key Encryption                           │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 3: Authorization                             │
│  - Role-Based Access Control (RBAC)                 │
│  - Protected Routes Middleware                      │
│  - Smart Contract Access Modifiers                  │
│  - User Permission Checks                           │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 4: Data Security                             │
│  - Input Validation (express-validator)             │
│  - MongoDB Injection Protection                     │
│  - XSS Prevention                                   │
│  - Environment Variables (.env)                     │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 5: Blockchain Security                       │
│  - Smart Contract Auditing                          │
│  - Transaction Signing                              │
│  - Event Verification                               │
│  - Immutable Records                                │
└─────────────────────────────────────────────────────┘
```

## 🚀 Deployment Architecture

### Production Setup

```
┌────────────────────────────────────────────────────┐
│                 CLOUDFLARE CDN                      │
│              (SSL/DDoS Protection)                  │
└────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────┐
│              FRONTEND (Vercel/Netlify)              │
│                   React Build                       │
│              - Static Assets                        │
│              - Service Worker                       │
└────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────┐
│            BACKEND (Heroku/Railway)                 │
│              Express.js Server                      │
│              - REST API                             │
│              - JWT Auth                             │
│              - RBAC                                 │
└────────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  MongoDB     │ │  IPFS    │ │  Ethereum    │
│  Atlas       │ │  Pinata  │ │  Sepolia     │
│              │ │          │ │              │
│ - Batches    │ │ - Images │ │ - Contract   │
│ - Users      │ │ - Proofs │ │ - Txs        │
│ - History    │ │ - QR     │ │ - Events     │
└──────────────┘ └──────────┘ └──────────────┘
```

## 📊 Performance Metrics

### Expected Performance

```
Blockchain Operations
├── Contract Deployment: ~30s (testnet)
├── Batch Creation: ~15s (tx confirmation)
├── Status Update: ~12s (tx confirmation)
├── Batch Read: ~2s (RPC call)
└── Event Query: ~3s (filter + fetch)

Backend API
├── Authentication: <200ms
├── Batch CRUD: <300ms
├── IPFS Upload: ~2-5s
├── QR Generation: <500ms
└── Blockchain Verify: ~3s

Frontend
├── Page Load: <2s
├── Dashboard Render: <1s
├── Component Load: <500ms
├── Animation: 60fps
└── API Calls: <300ms
```

## 🔄 Scalability

### Horizontal Scaling

```
Load Balancer
      │
      ├─► Backend Server 1 ─┐
      ├─► Backend Server 2 ─┼─► MongoDB (Sharded)
      ├─► Backend Server 3 ─┘
      └─► Backend Server N

Blockchain Service (Shared)
      ├─► Infura RPC Pool
      ├─► Contract Instance Cache
      └─► Event Listener Service
```

## 📈 Monitoring & Logging

### Observability Stack

```
Application Logs
      │
      ├─► Winston Logger
      │     │
      │     ├─► File Transport (logs/)
      │     ├─► Console Transport
      │     └─► Error Tracking (Sentry)
      │
      ├─► Blockchain Events
      │     │
      │     └─► Event Listener Service
      │
      └─► API Metrics
            │
            ├─► Response Times
            ├─► Error Rates
            └─► Transaction Success
```

---

**Architecture Version:** 1.0.0
**Last Updated:** January 2024
**Status:** Production Ready 🚀
