// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IArbitrable {
    function rule(uint256 _disputeID, uint256 _ruling) external;
}

/// @title GenLayerArbitrator
/// @notice The judge address a Kleros Curate list points at (ERC-792 arbitrator). Curate opens a
/// dispute here when a listing is challenged. The ruling comes from the Authena contract on
/// GenLayer, carried by one relayer. Each ruling stores the GenLayer transaction it came from, so
/// anyone can check the relayer passed it on faithfully.
/// If no ruling arrives within `timeout`, anyone can close the dispute as "refuse to rule", so
/// deposits are never locked.
contract GenLayerArbitrator {
    enum DisputeStatus {
        Waiting,
        Appealable,
        Solved
    }

    struct Dispute {
        address arbitrable;
        uint64 createdAt;
        DisputeStatus status;
        uint8 ruling;
        bytes32 genlayerTx;
        uint64 ruledAt;
    }

    uint256 public constant MAX_RULING = 2; // 0 refuse to rule, 1 requester, 2 challenger

    address public immutable relayer;
    uint256 public immutable fee;
    uint256 public immutable timeout;
    /// @notice Address of the Authena contract on GenLayer that produces the rulings. Set once.
    string public court;

    Dispute[] public disputes;

    event DisputeCreation(uint256 indexed _disputeID, IArbitrable indexed _arbitrable);
    /// @dev The standard ERC-792 signal that a ruling exists. Kleros's Curate index reads a
    /// dispute's ruling only when this is emitted, so its website can show who won.
    event AppealPossible(uint256 indexed _disputeID, IArbitrable indexed _arbitrable);
    event RulingRelayed(uint256 indexed disputeID, uint256 ruling, bytes32 genlayerTx);
    event RulingTimedOut(uint256 indexed disputeID);
    event CourtSet(string court);

    error OnlyRelayer();
    error FeeTooLow();
    error NotWaiting();
    error InvalidRuling();
    error TooEarly();
    error CourtAlreadySet();
    error NoAppeals();

    constructor(address _relayer, uint256 _fee, uint256 _timeout) {
        relayer = _relayer;
        fee = _fee;
        timeout = _timeout;
        disputes.push(); // dispute IDs start at 1
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert OnlyRelayer();
        _;
    }

    function setCourt(string calldata _court) external onlyRelayer {
        if (bytes(court).length != 0) revert CourtAlreadySet();
        court = _court;
        emit CourtSet(_court);
    }

    // --- ERC-792 arbitrator interface, as Curate calls it ----------------------------------

    function arbitrationCost(bytes calldata) external view returns (uint256) {
        return fee;
    }

    function createDispute(uint256, bytes calldata) external payable returns (uint256 disputeID) {
        if (msg.value < fee) revert FeeTooLow();
        disputeID = disputes.length;
        disputes.push(Dispute(msg.sender, uint64(block.timestamp), DisputeStatus.Waiting, 0, bytes32(0), 0));
        emit DisputeCreation(disputeID, IArbitrable(msg.sender));
    }

    function disputeStatus(uint256 _disputeID) external view returns (DisputeStatus) {
        return disputes[_disputeID].status;
    }

    function currentRuling(uint256 _disputeID) external view returns (uint256) {
        return disputes[_disputeID].ruling;
    }

    /// @notice No appeals: the appeal period is empty (it starts and ends when the ruling was
    /// given), so Curate never accepts appeal funding. Kleros's website shows that time as the
    /// ruling's date, so it must be the real one, not zero.
    function appealPeriod(uint256 _disputeID) external view returns (uint256 start, uint256 end) {
        uint256 at = disputes[_disputeID].ruledAt;
        return (at, at);
    }

    function appealCost(uint256, bytes calldata) external pure returns (uint256) {
        return type(uint256).max;
    }

    function appeal(uint256, bytes calldata) external payable {
        revert NoAppeals();
    }

    // --- Rulings ---------------------------------------------------------------------------

    /// @notice Passes on a finalized GenLayer verdict.
    /// @param _genlayerTx The GenLayer transaction that stored the verdict.
    function giveRuling(uint256 _disputeID, uint256 _ruling, bytes32 _genlayerTx) external onlyRelayer {
        if (_ruling > MAX_RULING) revert InvalidRuling();
        Dispute storage d = _waiting(_disputeID);
        d.status = DisputeStatus.Solved;
        d.ruling = uint8(_ruling);
        d.genlayerTx = _genlayerTx;
        d.ruledAt = uint64(block.timestamp);
        emit RulingRelayed(_disputeID, _ruling, _genlayerTx);
        emit AppealPossible(_disputeID, IArbitrable(d.arbitrable));
        IArbitrable(d.arbitrable).rule(_disputeID, _ruling);
    }

    /// @notice Anyone can close a dispute that got no ruling in time. Curate then keeps the
    /// skill off the list and splits the deposits.
    function refuse(uint256 _disputeID) external {
        Dispute storage d = _waiting(_disputeID);
        if (block.timestamp < uint256(d.createdAt) + timeout) revert TooEarly();
        d.status = DisputeStatus.Solved;
        d.ruledAt = uint64(block.timestamp);
        emit RulingTimedOut(_disputeID);
        emit AppealPossible(_disputeID, IArbitrable(d.arbitrable));
        IArbitrable(d.arbitrable).rule(_disputeID, 0);
    }

    function withdrawFees() external onlyRelayer {
        (bool ok, ) = relayer.call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }

    function disputeCount() external view returns (uint256) {
        return disputes.length - 1;
    }

    function _waiting(uint256 _disputeID) private view returns (Dispute storage d) {
        if (_disputeID == 0 || _disputeID >= disputes.length) revert NotWaiting();
        d = disputes[_disputeID];
        if (d.status != DisputeStatus.Waiting) revert NotWaiting();
    }
}
