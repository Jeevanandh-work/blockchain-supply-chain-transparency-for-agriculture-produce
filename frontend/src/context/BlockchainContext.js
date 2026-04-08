import React, { createContext, useState, useContext, useEffect } from 'react';
import { ethers } from 'ethers';
import SupplyChainABI from '../contracts/SupplyChain.json';

const BlockchainContext = createContext();

export const useBlockchain = () => {
  const context = useContext(BlockchainContext);
  if (!context) {
    throw new Error('useBlockchain must be used within a BlockchainProvider');
  }
  return context;
};

export const BlockchainProvider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [connected, setConnected] = useState(false);

  const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS;
  const RPC_URL = process.env.REACT_APP_RPC_URL || 'http://127.0.0.1:8545';

  useEffect(() => {
    initializeProvider();
  }, []);

  const initializeProvider = async () => {
    try {
      // Try to connect to MetaMask first
      if (window.ethereum) {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(web3Provider);

        // Load contract
        if (CONTRACT_ADDRESS) {
          const contractInstance = new ethers.Contract(
            CONTRACT_ADDRESS,
            SupplyChainABI.abi || [],
            web3Provider
          );
          setContract(contractInstance);
        }
      } else {
        // Fallback to JSON-RPC provider
        const jsonRpcProvider = new ethers.JsonRpcProvider(RPC_URL);
        setProvider(jsonRpcProvider);

        if (CONTRACT_ADDRESS) {
          const contractInstance = new ethers.Contract(
            CONTRACT_ADDRESS,
            SupplyChainABI.abi || [],
            jsonRpcProvider
          );
          setContract(contractInstance);
        }
      }
    } catch (error) {
      console.error('Provider initialization error:', error);
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return { success: false, message: 'MetaMask not found' };
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      setAccount(accounts[0]);
      setConnected(true);

      return { success: true, account: accounts[0] };
    } catch (error) {
      console.error('Wallet connection error:', error);
      return {
        success: false,
        message: error.message || 'Failed to connect wallet',
      };
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setConnected(false);
  };

  const getBatch = async (batchId) => {
    try {
      if (!contract) {
        throw new Error('Contract not initialized');
      }

      const batch = await contract.getBatch(batchId);
      return {
        batchId: batch[0],
        farmer: batch[1],
        currentOwner: batch[2],
        ipfsHash: batch[3],
        statusUpdates: batch[4],
        createdAt: Number(batch[5]),
        updatedAt: Number(batch[6]),
      };
    } catch (error) {
      console.error('Get batch error:', error);
      throw error;
    }
  };

  const getBatchHistory = async (batchId) => {
    try {
      if (!contract) {
        throw new Error('Contract not initialized');
      }

      return await contract.getBatchHistory(batchId);
    } catch (error) {
      console.error('Get batch history error:', error);
      throw error;
    }
  };

  const getQualityRecords = async (batchId) => {
    try {
      if (!contract) {
        throw new Error('Contract not initialized');
      }

      const records = await contract.getQualityRecords(batchId);
      return records.map((record) => ({
        qualityHash: record.qualityHash,
        recordedBy: record.recordedBy,
        timestamp: Number(record.timestamp),
      }));
    } catch (error) {
      console.error('Get quality records error:', error);
      throw error;
    }
  };

  const getTransportAssignment = async (batchId) => {
    try {
      if (!contract) {
        throw new Error('Contract not initialized');
      }

      if (typeof contract.getTransportAssignment !== 'function') {
        return null;
      }

      const assignment = await contract.getTransportAssignment(batchId);
      return {
        transporterAddress: assignment[0],
        assignedBy: assignment[1],
        assignedAt: Number(assignment[2]),
        exists: assignment[3],
      };
    } catch (error) {
      console.error('Get transport assignment error:', error);
      throw error;
    }
  };

  const value = {
    provider,
    contract,
    account,
    connected,
    connectWallet,
    disconnectWallet,
    getBatch,
    getBatchHistory,
    getQualityRecords,
    getTransportAssignment,
  };

  return (
    <BlockchainContext.Provider value={value}>
      {children}
    </BlockchainContext.Provider>
  );
};
