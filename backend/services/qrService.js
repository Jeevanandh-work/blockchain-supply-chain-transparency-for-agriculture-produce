const QRCode = require('qrcode');

class QRService {
  /**
   * Generate QR code as Base64 string
   * @param {string} data - Data to encode
   * @returns {string} Base64 encoded QR code
   */
  async generateQRBase64(data) {
    try {
      const qrCode = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        width: 300,
      });
      
      return qrCode;
    } catch (error) {
      console.error('QR generation error:', error);
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate QR code as Buffer
   * @param {string} data - Data to encode
   * @returns {Buffer} QR code buffer
   */
  async generateQRBuffer(data) {
    try {
      const qrCode = await QRCode.toBuffer(data, {
        errorCorrectionLevel: 'H',
        type: 'png',
        quality: 0.95,
        margin: 1,
        width: 300,
      });
      
      return qrCode;
    } catch (error) {
      console.error('QR generation error:', error);
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate batch QR code data
   * @param {string} batchId - Batch identifier
   * @param {string} contractAddress - Smart contract address
   * @returns {object} QR data object
   */
  generateBatchQRData(batchId, contractAddress) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    return {
      batchId,
      contractAddress,
      url: `${frontendUrl}/batch/${batchId}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate QR code for batch
   * @param {string} batchId - Batch identifier
   * @param {string} contractAddress - Smart contract address
   * @returns {string} Base64 encoded QR code
   */
  async generateBatchQR(batchId, contractAddress) {
    const qrData = this.generateBatchQRData(batchId, contractAddress);
    const dataString = JSON.stringify(qrData);
    
    return await this.generateQRBase64(dataString);
  }
}

module.exports = new QRService();
