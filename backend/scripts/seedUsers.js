require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
0
const users = [
  {
    name: 'John Farmer',
    email: 'john@example.com',
    password: 'password123',
    walletAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    role: 'Farmer',
    phoneNumber: '+1234567890',
    organization: 'Green Farms',
  },
  {
    name: 'Diana Distributor',
    email: 'diana@example.com',
    password: 'password123',
    walletAddress: '0x3c44cddd6ba900fa2b585dd299e03d12fa4293bc',
    role: 'Distributor',
    phoneNumber: '+1234567891',
    organization: 'Agri Distributors',
  },
  {
    name: 'Tom Transport',
    email: 'tom@example.com',
    password: 'password123',
    walletAddress: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
    role: 'Transport',
    phoneNumber: '+1234567892',
    organization: 'Fast Transport Co',
  },
  {
    name: 'Rita Retailer',
    email: 'rita@example.com',
    password: 'password123',
    walletAddress: '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
    role: 'Retailer',
    phoneNumber: '+1234567893',
    organization: 'Retail Hub',
  },
];

const seed = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    await User.deleteMany({ email: { $in: users.map((user) => user.email) } });

    for (const user of users) {
      await User.create(user);
    }

    console.log(`Seeded ${users.length} demo users into MongoDB Atlas with hashed passwords`);
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

seed();
