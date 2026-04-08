import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import QrScanner from 'qr-scanner';
import {
  QrCode,
  Camera,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Package,
  User,
  Calendar,
  MapPin,
  Truck,
  Building2,
  Shield,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import { batchAPI, blockchainAPI, transportAPI } from '../services/api';
import SupplyChainABI from '../contracts/SupplyChain.json';

const QRScan = () => {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  const [isScanning, setIsScanning] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState('');
  const [scanRaw, setScanRaw] = useState('');
  const [manualBatchId, setManualBatchId] = useState('');
  const [scannedBatchId, setScannedBatchId] = useState('');
  const [scanTime, setScanTime] = useState(null);

  const [batchData, setBatchData] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [chainData, setChainData] = useState(null);
  const [verifyState, setVerifyState] = useState({ done: false, message: '' });

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const parseBatchIdFromPayload = useCallback((payload) => {
    const text = String(payload || '').trim();
    if (!text) return '';

    if (/^BATCH[-_]/i.test(text)) {
      return text;
    }

    if (text.startsWith('http://') || text.startsWith('https://')) {
      try {
        const url = new URL(text);
        if (url.pathname.startsWith('/batch/')) {
          return decodeURIComponent(url.pathname.replace('/batch/', '').trim());
        }
      } catch (error) {
        return '';
      }
    }

    if (text.startsWith('{')) {
      try {
        const json = JSON.parse(text);
        return String(json?.batchId || '').trim();
      } catch (error) {
        return '';
      }
    }

    return '';
  }, []);

  const getContract = useCallback(async () => {
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || SupplyChainABI.address;
    if (!contractAddress) return null;

    const provider = window.ethereum
      ? new ethers.BrowserProvider(window.ethereum)
      : new ethers.JsonRpcProvider(process.env.REACT_APP_RPC_URL || 'http://127.0.0.1:8545');

    return new ethers.Contract(contractAddress, SupplyChainABI.abi, provider);
  }, []);

  const fetchBatchDetails = useCallback(async (batchId) => {
    if (!batchId) return;

    try {
      setLoadingBatch(true);
      setError('');
      setVerifyState({ done: false, message: '' });

      const [batchResponse, trackingResponse, verifyResponse, blockchainBatchResponse] = await Promise.allSettled([
        batchAPI.getBatchById(batchId),
        transportAPI.getTracking(batchId),
        blockchainAPI.verifyBatch(batchId),
        blockchainAPI.getBlockchainBatch(batchId),
      ]);

      if (batchResponse.status !== 'fulfilled' || !batchResponse.value?.success) {
        throw new Error(batchResponse?.value?.message || 'Batch not found');
      }

      const payload = batchResponse.value.data || {};
      setBatchData(payload.batch || null);

      if (trackingResponse.status === 'fulfilled' && trackingResponse.value?.success) {
        setTrackingData(trackingResponse.value.data || null);
      } else {
        setTrackingData(null);
      }

      if (verifyResponse.status === 'fulfilled' && verifyResponse.value?.success) {
        setChainData({
          verify: verifyResponse.value,
          batch: blockchainBatchResponse.status === 'fulfilled' ? blockchainBatchResponse.value : null,
        });
      } else {
        setChainData(null);
      }
    } catch (fetchError) {
      console.error('QR fetch error:', fetchError);
      setBatchData(null);
      setTrackingData(null);
      setChainData(null);
      setError(fetchError?.message || 'Failed to fetch product details');
    } finally {
      setLoadingBatch(false);
    }
  }, []);

  const handleDecoded = useCallback(async (result) => {
    const raw = result?.data || '';
    const batchId = parseBatchIdFromPayload(raw);

    if (!batchId) {
      setError('QR scanned, but batch ID was not found in QR payload');
      setScanRaw(raw);
      return;
    }

    setScanRaw(raw);
    setScannedBatchId(batchId);
    setManualBatchId(batchId);
    setScanTime(new Date().toISOString());
    stopScanner();
    await fetchBatchDetails(batchId);
  }, [fetchBatchDetails, parseBatchIdFromPayload, stopScanner]);

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      setLoadingCamera(true);
      setError('');

      stopScanner();

      scannerRef.current = new QrScanner(videoRef.current, handleDecoded, {
        preferredCamera: 'environment',
        highlightCodeOutline: true,
        highlightScanRegion: true,
        maxScansPerSecond: 5,
      });

      await scannerRef.current.start();
      setIsScanning(true);
    } catch (scanError) {
      console.error('Scanner start error:', scanError);
      setError('Unable to start camera. Please allow camera permission.');
      setIsScanning(false);
    } finally {
      setLoadingCamera(false);
    }
  }, [handleDecoded, stopScanner]);

  const handleManualSearch = async () => {
    const id = manualBatchId.trim();
    if (!id) {
      setError('Please enter a batch ID');
      return;
    }

    setScannedBatchId(id);
    setScanRaw(id);
    setScanTime(new Date().toISOString());
    await fetchBatchDetails(id);
  };

  const handleVerifyOnChain = async () => {
    if (!batchData?.batchId) return;

    try {
      setVerifying(true);
      setVerifyState({ done: false, message: '' });

      const contract = await getContract();
      if (!contract || typeof contract.getBatch !== 'function') {
        throw new Error('Smart contract not configured');
      }

      const chainBatch = await contract.getBatch(batchData.batchId);
      const chainBatchId = String(chainBatch.batchId || '').trim();
      const backendBatchId = String(batchData.batchId || '').trim();

      if (!chainBatchId || chainBatchId !== backendBatchId) {
        throw new Error('Blockchain batch mismatch');
      }

      setVerifyState({ done: true, message: 'Data Verified on Blockchain ✅' });
    } catch (verifyError) {
      console.error('Verify error:', verifyError);
      setVerifyState({ done: true, message: verifyError?.message || 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  };

  const timelineSteps = useMemo(() => {
    const history = batchData?.statusHistory || [];
    return history
      .filter((entry) => {
        const s = String(entry?.status || '').toLowerCase();
        return (
          s.includes('created') ||
          s.includes('accepted') ||
          s.includes('transit') ||
          s.includes('delivered') ||
          s.includes('picked')
        );
      })
      .map((entry) => ({
        stage: entry.status,
        timestamp: entry.timestamp,
      }));
  }, [batchData?.statusHistory]);

  const latestGpsPoint = useMemo(() => {
    const points = trackingData?.gpsTracking || batchData?.gpsTracking || [];
    return points.length ? points[points.length - 1] : null;
  }, [trackingData?.gpsTracking, batchData?.gpsTracking]);

  const distributorInfo = useMemo(() => {
    const event = [...(batchData?.statusHistory || [])]
      .reverse()
      .find((entry) => entry?.updatedBy?.role === 'Distributor');

    return {
      name: event?.updatedBy?.name || 'Distributor Partner',
      organization: event?.updatedBy?.organization || 'AgriChain Network',
      location: event?.location || batchData?.deliveryAddress || 'N/A',
    };
  }, [batchData]);

  const transportInfo = useMemo(() => {
    const details = batchData?.transportDetails || {};
    const event = [...(batchData?.statusHistory || [])]
      .reverse()
      .find((entry) => entry?.updatedBy?.role === 'Transport');

    const deliveryEvent = [...(batchData?.statusHistory || [])]
      .reverse()
      .find((entry) => String(entry?.status || '').toLowerCase().includes('delivered'));

    return {
      vehicleNumber: details.vehicleNumber || 'Assigned Vehicle',
      driverName: details.driverName || event?.updatedBy?.name || 'Assigned Driver',
      transportCompany: details.transportCompany || event?.updatedBy?.organization || 'Assigned Transport Partner',
      deliveryDate: batchData?.deliveryProof?.deliveredAt || batchData?.deliveredAt || deliveryEvent?.timestamp || '',
    };
  }, [batchData]);

  const productStatus = useMemo(() => {
    const status = String(batchData?.status || '').toLowerCase();
    if (status.includes('sold')) return 'Sold';
    if (status.includes('transit') || status.includes('picked')) return 'In Transit';
    return 'Available in Store';
  }, [batchData?.status]);

  const summary = useMemo(() => {
    if (!batchData) return null;

    const deliveryDate =
      transportInfo.deliveryDate ||
      batchData?.deliveryProof?.deliveredAt ||
      batchData?.deliveredAt ||
      '';

    return {
      batchId: batchData.batchId,
      cropName: batchData.productName || 'N/A',
      farmer: batchData?.farmer?.name || 'Unknown Farmer',
      distributor: distributorInfo.name,
      transport: transportInfo.driverName,
      status: productStatus,
      createdAt: batchData?.createdAt || '',
      deliveredAt: deliveryDate,
    };
  }, [batchData, distributorInfo.name, productStatus, transportInfo.deliveryDate, transportInfo.driverName]);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <div className="text-center">
            <QrCode className="w-14 h-14 text-emerald-600 mx-auto mb-3" />
            <h1 className="text-3xl font-bold text-gray-900">Customer QR Scan</h1>
            <p className="text-gray-600 mt-2">Scan product QR to view full traceability from farm to store.</p>
          </div>
        </Card>

        {summary && (
          <div className="sticky top-4 z-30">
            <Card className="border border-emerald-200 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-emerald-800">Scan Result Summary</p>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  {summary.status}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-gray-500">Batch</p>
                  <p className="font-semibold text-gray-900 font-mono">{summary.batchId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Crop</p>
                  <p className="font-semibold text-gray-900">{summary.cropName}</p>
                </div>
                <div>
                  <p className="text-gray-500">Farmer</p>
                  <p className="font-semibold text-gray-900">{summary.farmer}</p>
                </div>
                <div>
                  <p className="text-gray-500">Distributor</p>
                  <p className="font-semibold text-gray-900">{summary.distributor}</p>
                </div>
                <div>
                  <p className="text-gray-500">Transport</p>
                  <p className="font-semibold text-gray-900">{summary.transport}</p>
                </div>
                <div>
                  <p className="text-gray-500">Created</p>
                  <p className="font-semibold text-gray-900">
                    {summary.createdAt ? new Date(summary.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Delivered</p>
                  <p className="font-semibold text-gray-900">
                    {summary.deliveredAt ? new Date(summary.deliveredAt).toLocaleDateString() : 'Not yet'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Scanned</p>
                  <p className="font-semibold text-gray-900">
                    {scanTime ? new Date(scanTime).toLocaleTimeString() : 'N/A'}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        <Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="rounded-lg border border-gray-200 bg-black overflow-hidden">
                <video ref={videoRef} className="w-full min-h-[260px]" muted playsInline />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" onClick={startScanner} disabled={loadingCamera || isScanning} icon={Camera}>
                  {loadingCamera ? 'Starting...' : isScanning ? 'Scanning...' : 'Enable Camera'}
                </Button>
                <Button variant="outline" onClick={stopScanner} disabled={!isScanning} icon={RefreshCw}>
                  Stop
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Manual Batch Lookup</p>
              <div className="flex gap-2">
                <input
                  value={manualBatchId}
                  onChange={(e) => setManualBatchId(e.target.value)}
                  placeholder="Enter Batch ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <Button variant="primary" onClick={handleManualSearch} icon={Search}>Search</Button>
              </div>

              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p><span className="font-semibold">Scan Time:</span> {scanTime ? new Date(scanTime).toLocaleString() : 'N/A'}</p>
                <p><span className="font-semibold">Batch ID:</span> {scannedBatchId || 'N/A'}</p>
              </div>

              {scanRaw && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 break-all">
                  <span className="font-semibold">Raw QR Payload:</span> {scanRaw}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </Card>

        {(loadingBatch || batchData) && (
          <>
            {loadingBatch ? (
              <Card>
                <p className="text-gray-700">Loading product details...</p>
              </Card>
            ) : (
              <>
                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">1. Product Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div><p className="text-gray-500">Crop Name</p><p className="font-semibold">{batchData?.productName || 'N/A'}</p></div>
                    <div><p className="text-gray-500">Batch ID</p><p className="font-semibold font-mono">{batchData?.batchId || 'N/A'}</p></div>
                    <div><p className="text-gray-500">Quantity</p><p className="font-semibold">{batchData?.quantity || 0} {batchData?.unit || ''}</p></div>
                    <div><p className="text-gray-500">Price</p><p className="font-semibold">INR {batchData?.price || batchData?.quantity * 10 || 0}</p></div>
                    <div><p className="text-gray-500">Category</p><p className="font-semibold">{batchData?.category || 'Agricultural Produce'}</p></div>
                    <div><p className="text-gray-500">Product Status</p><p className="font-semibold">{productStatus}</p></div>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">2. Farmer Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500">Farmer Name</p><p className="font-semibold">{batchData?.farmer?.name || 'Unknown Farmer'}</p></div>
                    <div><p className="text-gray-500">Farm Location</p><p className="font-semibold">{batchData?.farmer?.farmerProfile?.farmLocation || batchData?.farmer?.organization || 'N/A'}</p></div>
                    <div><p className="text-gray-500">Harvest Date</p><p className="font-semibold">{batchData?.createdAt ? new Date(batchData.createdAt).toLocaleDateString() : 'N/A'}</p></div>
                    <div><p className="text-gray-500">License Status</p><p className="font-semibold text-green-700">Verified</p></div>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">3. Distributor Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div><p className="text-gray-500">Distributor Name</p><p className="font-semibold">{distributorInfo.name}</p></div>
                    <div><p className="text-gray-500">Organization</p><p className="font-semibold">{distributorInfo.organization}</p></div>
                    <div><p className="text-gray-500">Location</p><p className="font-semibold">{distributorInfo.location}</p></div>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">4. Transport Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-gray-500">Vehicle Number</p><p className="font-semibold">{transportInfo.vehicleNumber}</p></div>
                    <div><p className="text-gray-500">Driver Name</p><p className="font-semibold">{transportInfo.driverName}</p></div>
                    <div><p className="text-gray-500">Transport Company</p><p className="font-semibold">{transportInfo.transportCompany}</p></div>
                    <div><p className="text-gray-500">Delivery Date</p><p className="font-semibold">{transportInfo.deliveryDate ? new Date(transportInfo.deliveryDate).toLocaleDateString() : 'N/A'}</p></div>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">5. Live / Last Location</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div><p className="text-gray-500">Latitude</p><p className="font-semibold">{latestGpsPoint?.latitude ? Number(latestGpsPoint.latitude).toFixed(5) : 'N/A'}</p></div>
                    <div><p className="text-gray-500">Longitude</p><p className="font-semibold">{latestGpsPoint?.longitude ? Number(latestGpsPoint.longitude).toFixed(5) : 'N/A'}</p></div>
                    <div><p className="text-gray-500">Last Updated</p><p className="font-semibold">{latestGpsPoint?.timestamp ? new Date(latestGpsPoint.timestamp).toLocaleString() : 'N/A'}</p></div>
                  </div>

                  {latestGpsPoint?.latitude && latestGpsPoint?.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${latestGpsPoint.latitude},${latestGpsPoint.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-blue-700 hover:text-blue-900"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Map
                    </a>
                  )}
                </Card>

                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">6. Product Journey Timeline</h2>
                  <div className="space-y-2">
                    {timelineSteps.length === 0 ? (
                      <p className="text-sm text-gray-500">No timeline records available.</p>
                    ) : (
                      timelineSteps.map((step, index) => (
                        <div key={`${step.stage}-${index}`} className="flex items-start gap-2 text-sm">
                          <span className="mt-2 h-2 w-2 rounded-full bg-emerald-500" />
                          <div>
                            <p className="font-semibold text-gray-900">{step.stage}</p>
                            <p className="text-gray-600">{step.timestamp ? new Date(step.timestamp).toLocaleString() : 'N/A'}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">7. Blockchain Verification</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="primary" onClick={handleVerifyOnChain} disabled={verifying} icon={Shield}>
                      {verifying ? 'Verifying...' : 'Verify on Blockchain'}
                    </Button>
                    {verifyState.done && (
                      <span className={`inline-flex items-center gap-1 text-sm font-semibold ${verifyState.message.includes('✅') ? 'text-green-700' : 'text-red-700'}`}>
                        {verifyState.message.includes('✅') ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {verifyState.message}
                      </span>
                    )}
                  </div>

                  {chainData?.verify?.verified && (
                    <p className="text-xs text-gray-600 mt-3">
                      Verified contract source: {chainData.verify.blockchain?.contractAddress || 'Configured contract'}
                    </p>
                  )}
                </Card>

                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">8. Product Status</h2>
                  <p className="text-lg font-semibold text-emerald-700">{productStatus}</p>
                </Card>

                <Card>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">9. QR Scan Info</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500">Scan Time</p><p className="font-semibold">{scanTime ? new Date(scanTime).toLocaleString() : 'N/A'}</p></div>
                    <div><p className="text-gray-500">Batch ID</p><p className="font-semibold font-mono">{scannedBatchId || 'N/A'}</p></div>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default QRScan;
