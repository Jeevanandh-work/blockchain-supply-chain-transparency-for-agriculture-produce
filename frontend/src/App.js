import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BlockchainProvider } from './context/BlockchainContext';

// Auth pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// Dashboard pages
import FarmerDashboard from './pages/Dashboard/FarmerDashboard';
import DistributorDashboard from './pages/Dashboard/DistributorDashboard';
import TransportDashboard from './pages/Dashboard/TransportDashboard';
import RetailerDashboard from './pages/Dashboard/RetailerDashboard';
import ConsumerDashboard from './pages/Dashboard/ConsumerDashboard';

// Other pages
import BatchDetails from './pages/BatchDetails';
import QRScan from './pages/QRScan';
import NotFound from './pages/NotFound';

// Components
import PrivateRoute from './components/PrivateRoute';
import PublicRoute from './components/PublicRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <BlockchainProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/batch/:id" element={<BatchDetails />} />
            <Route path="/scan" element={<QRScan />} />

            {/* Protected dashboard routes */}
            <Route
              path="/dashboard/farmer"
              element={
                <PrivateRoute role="Farmer">
                  <FarmerDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/distributor"
              element={
                <PrivateRoute role="Distributor">
                  <DistributorDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/transport"
              element={
                <PrivateRoute role="Transport">
                  <TransportDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/retailer"
              element={
                <PrivateRoute role="Retailer">
                  <RetailerDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard/consumer"
              element={
                <PrivateRoute role="Consumer">
                  <ConsumerDashboard />
                </PrivateRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BlockchainProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
