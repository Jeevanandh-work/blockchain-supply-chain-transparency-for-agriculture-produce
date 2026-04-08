// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SupplyChain
 * @dev Blockchain-based supply chain transparency for agricultural produce
 * @notice Implements role-based access control and immutable batch tracking
 */
contract SupplyChain {
    
    // ============ State Variables ============
    
    enum Role { None, Farmer, Distributor, Transport, Retailer, Consumer }
    
    struct Batch {
        string batchId;
        address farmer;
        address currentOwner;
        string ipfsHash;
        string[] statusUpdates;
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }
    
    struct QualityRecord {
        string qualityHash;
        address recordedBy;
        uint256 timestamp;
    }

    struct TransportAssignment {
        address transporter;
        address assignedBy;
        uint256 assignedAt;
        bool exists;
    }
    
    // Mappings
    mapping(string => Batch) public batches;
    mapping(address => Role) public userRoles;
    mapping(string => QualityRecord[]) public qualityRecords;
    mapping(string => address[]) public batchHistory;
    mapping(string => TransportAssignment) public transportAssignments;
    
    // Arrays
    string[] public batchIds;
    
    // Owner
    address public owner;
    
    // ============ Events ============
    
    event BatchCreated(
        string indexed batchId,
        address indexed farmer,
        string ipfsHash,
        uint256 timestamp
    );
    
    event BatchTransferred(
        string indexed batchId,
        address indexed from,
        address indexed to,
        string updateMsg,
        uint256 timestamp
    );
    
    event QualityRecorded(
        string indexed batchId,
        address indexed recordedBy,
        string qualityHash,
        uint256 timestamp
    );
    
    event RoleAssigned(
        address indexed user,
        Role role,
        uint256 timestamp
    );
    
    event StatusUpdated(
        string indexed batchId,
        address indexed updatedBy,
        string status,
        string location,
        uint256 timestamp
    );
    
    event BatchDelivered(
        string indexed batchId,
        address indexed deliveredBy,
        string recipientName,
        uint256 timestamp
    );

    event TransporterAssigned(
        string indexed batchId,
        address indexed assignedBy,
        address indexed transporter,
        uint256 timestamp
    );
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    modifier onlyFarmer() {
        require(userRoles[msg.sender] == Role.Farmer, "Only farmers can perform this action");
        _;
    }
    
    modifier onlyAuthorizedTransfer() {
        Role role = userRoles[msg.sender];
        require(
            role == Role.Distributor || 
            role == Role.Transport || 
            role == Role.Retailer,
            "Only distributor, transport, or retailer can transfer"
        );
        _;
    }

    modifier onlyDistributor() {
        require(userRoles[msg.sender] == Role.Distributor, "Only distributors can perform this action");
        _;
    }
    
    modifier batchExists(string memory _batchId) {
        require(batches[_batchId].exists, "Batch does not exist");
        _;
    }
    
    modifier batchNotExists(string memory _batchId) {
        require(!batches[_batchId].exists, "Batch already exists");
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {
        owner = msg.sender;
        userRoles[msg.sender] = Role.Farmer; // Owner is also a farmer by default
    }
    
    // ============ Role Management ============
    
    /**
     * @dev Assign role to a user
     * @param _user Address of the user
     * @param _role Role to assign
     */
    function assignRole(address _user, Role _role) external onlyOwner {
        require(_user != address(0), "Invalid address");
        require(_role != Role.None, "Invalid role");
        
        userRoles[_user] = _role;
        emit RoleAssigned(_user, _role, block.timestamp);
    }
    
    /**
     * @dev Get role of a user
     * @param _user Address of the user
     * @return Role of the user
     */
    function getRole(address _user) external view returns (Role) {
        return userRoles[_user];
    }
    
    // ============ Batch Management ============
    
    /**
     * @dev Create a new batch
     * @param _batchId Unique identifier for the batch
     * @param _ipfsHash IPFS hash containing batch metadata
     */
    function createBatch(
        string memory _batchId,
        string memory _ipfsHash
    ) external onlyFarmer batchNotExists(_batchId) {
        require(bytes(_batchId).length > 0, "Batch ID cannot be empty");
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        
        Batch storage newBatch = batches[_batchId];
        newBatch.batchId = _batchId;
        newBatch.farmer = msg.sender;
        newBatch.currentOwner = msg.sender;
        newBatch.ipfsHash = _ipfsHash;
        newBatch.createdAt = block.timestamp;
        newBatch.updatedAt = block.timestamp;
        newBatch.exists = true;
        
        newBatch.statusUpdates.push("Batch created by farmer");
        batchHistory[_batchId].push(msg.sender);
        batchIds.push(_batchId);
        
        emit BatchCreated(_batchId, msg.sender, _ipfsHash, block.timestamp);
    }
    
    /**
     * @dev Transfer batch ownership to another actor
     * @param _batchId ID of the batch to transfer
     * @param _to Address of the recipient
     * @param _updateMsg Status update message
     */
    function transferBatch(
        string memory _batchId,
        address _to,
        string memory _updateMsg
    ) external onlyAuthorizedTransfer batchExists(_batchId) {
        Batch storage batch = batches[_batchId];
        
        require(batch.currentOwner == msg.sender, "You are not the current owner");
        require(_to != address(0), "Invalid recipient address");
        require(userRoles[_to] != Role.None, "Recipient must have a role");
        require(bytes(_updateMsg).length > 0, "Update message cannot be empty");
        
        address previousOwner = batch.currentOwner;
        batch.currentOwner = _to;
        batch.updatedAt = block.timestamp;
        batch.statusUpdates.push(_updateMsg);
        batchHistory[_batchId].push(_to);
        
        emit BatchTransferred(_batchId, previousOwner, _to, _updateMsg, block.timestamp);
    }

    /**
     * @dev Assign a transporter to a batch without transferring ownership
     * @param _batchId ID of the batch to assign
     * @param _transporter Address of the transporter
     */
    function assignTransporter(
        string memory _batchId,
        address _transporter
    ) external onlyDistributor batchExists(_batchId) {
        require(_transporter != address(0), "Invalid transporter address");
        require(userRoles[_transporter] == Role.Transport, "Transporter must have transport role");

        Batch storage batch = batches[_batchId];
        require(batch.currentOwner == msg.sender, "Only the current distributor owner can assign a transporter");

        transportAssignments[_batchId] = TransportAssignment({
            transporter: _transporter,
            assignedBy: msg.sender,
            assignedAt: block.timestamp,
            exists: true
        });

        batch.updatedAt = block.timestamp;
        batch.statusUpdates.push("Transporter assigned");

        emit TransporterAssigned(_batchId, msg.sender, _transporter, block.timestamp);
    }
    
    /**
     * @dev Record quality inspection
     * @param _batchId ID of the batch
     * @param _qualityHash IPFS hash of quality inspection document
     */
    function recordQuality(
        string memory _batchId,
        string memory _qualityHash
    ) external batchExists(_batchId) {
        require(bytes(_qualityHash).length > 0, "Quality hash cannot be empty");
        
        Role role = userRoles[msg.sender];
        require(
            role == Role.Farmer ||
            role == Role.Distributor ||
            role == Role.Transport ||
            role == Role.Retailer,
            "Unauthorized to record quality"
        );
        
        QualityRecord memory newRecord = QualityRecord({
            qualityHash: _qualityHash,
            recordedBy: msg.sender,
            timestamp: block.timestamp
        });
        
        qualityRecords[_batchId].push(newRecord);
        batches[_batchId].statusUpdates.push("Quality inspection recorded");
        
        emit QualityRecorded(_batchId, msg.sender, _qualityHash, block.timestamp);
    }
    
    /**
     * @dev Update batch status (for transport tracking)
     * @param _batchId ID of the batch
     * @param _status New status (e.g., "In Transit", "Picked Up")
     * @param _location Current location
     */
    function updateStatus(
        string memory _batchId,
        string memory _status,
        string memory _location
    ) external batchExists(_batchId) {
        require(bytes(_status).length > 0, "Status cannot be empty");
        require(bytes(_location).length > 0, "Location cannot be empty");
        
        Role role = userRoles[msg.sender];
        require(
            role == Role.Transport ||
            role == Role.Distributor ||
            role == Role.Retailer,
            "Unauthorized to update status"
        );
        
        Batch storage batch = batches[_batchId];
        batch.updatedAt = block.timestamp;
        
        string memory updateMsg = string(abi.encodePacked(
            _status,
            " at ",
            _location
        ));
        batch.statusUpdates.push(updateMsg);
        
        emit StatusUpdated(_batchId, msg.sender, _status, _location, block.timestamp);
    }
    
    /**
     * @dev Confirm delivery
     * @param _batchId ID of the batch
     * @param _recipientName Name of the recipient
     */
    function confirmDelivery(
        string memory _batchId,
        string memory _recipientName
    ) external batchExists(_batchId) {
        require(bytes(_recipientName).length > 0, "Recipient name cannot be empty");
        
        Role role = userRoles[msg.sender];
        require(role == Role.Transport, "Only transport can confirm delivery");
        
        Batch storage batch = batches[_batchId];
        batch.updatedAt = block.timestamp;
        
        string memory deliveryMsg = string(abi.encodePacked(
            "Delivered to ",
            _recipientName
        ));
        batch.statusUpdates.push(deliveryMsg);
        
        emit BatchDelivered(_batchId, msg.sender, _recipientName, block.timestamp);
    }
    
    // ============ Getter Functions ============
    
    /**
     * @dev Get complete batch details
     * @param _batchId ID of the batch
     * @return batchId Batch identifier
     * @return farmer Address of the farmer who created the batch
     * @return currentOwner Current owner address
     * @return ipfsHash IPFS hash of batch data
     * @return statusUpdates Array of status update messages
     * @return createdAt Batch creation timestamp
     * @return updatedAt Last update timestamp
     */
    function getBatch(string memory _batchId) 
        external 
        view 
        batchExists(_batchId) 
        returns (
            string memory batchId,
            address farmer,
            address currentOwner,
            string memory ipfsHash,
            string[] memory statusUpdates,
            uint256 createdAt,
            uint256 updatedAt
        ) 
    {
        Batch storage batch = batches[_batchId];
        return (
            batch.batchId,
            batch.farmer,
            batch.currentOwner,
            batch.ipfsHash,
            batch.statusUpdates,
            batch.createdAt,
            batch.updatedAt
        );
    }
    
    /**
     * @dev Get batch history (all owners)
     * @param _batchId ID of the batch
     * @return Array of addresses in ownership history
     */
    function getBatchHistory(string memory _batchId) 
        external 
        view 
        batchExists(_batchId) 
        returns (address[] memory) 
    {
        return batchHistory[_batchId];
    }
    
    /**
     * @dev Get quality records for a batch
     * @param _batchId ID of the batch
     * @return Array of quality records
     */
    function getQualityRecords(string memory _batchId) 
        external 
        view 
        batchExists(_batchId) 
        returns (QualityRecord[] memory) 
    {
        return qualityRecords[_batchId];
    }

    /**
     * @dev Get assigned transporter details for a batch
     * @param _batchId ID of the batch
     * @return transporter Assigned transporter address
     * @return assignedBy Address that assigned the transporter
     * @return assignedAt Assignment timestamp
     * @return exists Whether a transporter assignment exists
     */
    function getTransportAssignment(string memory _batchId)
        external
        view
        batchExists(_batchId)
        returns (
            address transporter,
            address assignedBy,
            uint256 assignedAt,
            bool exists
        )
    {
        TransportAssignment storage assignment = transportAssignments[_batchId];
        return (
            assignment.transporter,
            assignment.assignedBy,
            assignment.assignedAt,
            assignment.exists
        );
    }
    
    /**
     * @dev Get all batch IDs
     * @return Array of all batch IDs in the system
     */
    function getAllBatchIds() external view returns (string[] memory) {
        return batchIds;
    }
    
    /**
     * @dev Get total number of batches
     * @return Total count of batches
     */
    function getBatchCount() external view returns (uint256) {
        return batchIds.length;
    }
    
    /**
     * @dev Check if batch exists
     * @param _batchId ID of the batch
     * @return Boolean indicating existence
     */
    function batchExistsCheck(string memory _batchId) external view returns (bool) {
        return batches[_batchId].exists;
    }
}
