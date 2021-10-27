/*
██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░
*/

/*
 This is a contract that has been adapted from mStable. 
 The original smart contract can be found here: https://github.com/mstable/merkle-drop
 There have only been slight adaptations such as the removal of two external functions,
 the renaming of some parameters,
 and the addition of a blocknumber that needs to have passed for a drop to be claimable.
*/

// MerkelDrop.sol was originally published SPDX-License-Identifier: AGPL-3.0-or-later.
// Republished by PrimeDAO under GNU General Public License v3.0.

// MerkleDrop contract. Smart contract for executing merkle drops for ERC20 tokens.
// Copyright (C) 2021 PrimeDao

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {MerkleProof} from "openzeppelin-contracts-sol5/cryptography/MerkleProof.sol";
import {IERC20} from "openzeppelin-contracts-sol5/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts-sol5/token/ERC20/SafeERC20.sol";
import {SafeMath} from "openzeppelin-contracts-sol5/math/SafeMath.sol";

import {Initializable} from "@openzeppelin/upgrades/contracts/Initializable.sol";
import {InitializableGovernableWhitelist} from "@mstable/protocol/contracts/governance/InitializableGovernableWhitelist.sol";

contract MerkleDrop is Initializable, InitializableGovernableWhitelist {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event Claimed(address claimant, uint256 week, uint256 balance);
    event TrancheAdded(
        uint256 tranche,
        bytes32 merkleRoot,
        uint256 totalAmount
    );
    event TrancheExpired(uint256 tranche);
    event RemovedFunder(address indexed _address);

    IERC20 public token;

    mapping(uint256 => bytes32) public merkleRoots;
    mapping(uint256 => mapping(address => bool)) public claimed;
    uint256 tranches;

    function initialize(
        address _nexus,
        address[] calldata _funders,
        IERC20 _token
    ) external initializer {
        InitializableGovernableWhitelist._initialize(_nexus, _funders);
        token = _token;
    }

    /***************************************
                    ADMIN
    ****************************************/

    function seedNewAllocations(bytes32 _merkleRoot, uint256 _totalAllocation)
        public
        onlyWhitelisted
        returns (uint256 trancheId)
    {
        token.transferFrom(msg.sender, address(this), _totalAllocation);

        trancheId = tranches;
        merkleRoots[trancheId] = _merkleRoot;

        tranches = tranches.add(1);

        emit TrancheAdded(trancheId, _merkleRoot, _totalAllocation);
    }

    function expireTranche(uint256 _trancheId) public onlyWhitelisted {
        merkleRoots[_trancheId] = bytes32(0);

        emit TrancheExpired(_trancheId);
    }

    /***************************************
                  CLAIMING
    ****************************************/

    function claimTranche(
        address _claimer,
        uint256 _tranche,
        uint256 _balance,
        bytes32[] memory _merkleProof
    ) public {
        _claimTranche(_claimer, _tranche, _balance, _merkleProof);
        _disburse(_claimer, _balance);
    }

    function verifyClaim(
        address _claimer,
        uint256 _tranche,
        uint256 _balance,
        bytes32[] memory _merkleProof
    ) public view returns (bool valid) {
        return _verifyClaim(_claimer, _tranche, _balance, _merkleProof);
    }

    /***************************************
              CLAIMING - INTERNAL
    ****************************************/

    function _claimTranche(
        address _claimer,
        uint256 _tranche,
        uint256 _balance,
        bytes32[] memory _merkleProof
    ) private {
        require(_tranche < tranches, "Tranche does not yet exist");

        require(!claimed[_tranche][_claimer], "LP has already claimed");
        require(
            _verifyClaim(_claimer, _tranche, _balance, _merkleProof),
            "Incorrect merkle proof"
        );

        claimed[_tranche][_claimer] = true;

        emit Claimed(_claimer, _tranche, _balance);
    }

    function _verifyClaim(
        address _claimer,
        uint256 _tranche,
        uint256 _balance,
        bytes32[] memory _merkleProof
    ) private view returns (bool valid) {
        bytes32 leaf = keccak256(abi.encodePacked(_claimer, _balance));
        return MerkleProof.verify(_merkleProof, merkleRoots[_tranche], leaf);
    }

    function _disburse(address _claimer, uint256 _balance) private {
        if (_balance > 0) {
            token.safeTransfer(_claimer, _balance);
        } else {
            revert(
                "No balance would be transferred - not going to waste your gas"
            );
        }
    }
}
