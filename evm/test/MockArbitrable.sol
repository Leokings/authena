// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IArbitratorLike {
    function createDispute(uint256 _choices, bytes calldata _extraData) external payable returns (uint256);
    function arbitrationCost(bytes calldata _extraData) external view returns (uint256);
}

/// Stands in for a Curate list in local tests: opens disputes the way Curate does and records
/// the rulings it receives.
contract MockArbitrable {
    IArbitratorLike public arbitrator;
    mapping(uint256 => uint256) public rulings;
    mapping(uint256 => bool) public ruled;
    uint256 public lastDispute;

    constructor(IArbitratorLike _arbitrator) {
        arbitrator = _arbitrator;
    }

    function challenge() external payable returns (uint256 id) {
        id = arbitrator.createDispute{value: msg.value}(2, "");
        lastDispute = id;
    }

    function rule(uint256 _disputeID, uint256 _ruling) external {
        require(msg.sender == address(arbitrator), "only arbitrator");
        require(!ruled[_disputeID], "already ruled");
        ruled[_disputeID] = true;
        rulings[_disputeID] = _ruling;
    }
}
