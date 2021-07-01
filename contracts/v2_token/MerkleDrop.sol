pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import { MerkleProof } from "openzeppelin-contracts-sol5/cryptography/MerkleProof.sol";
import { IERC20 } from "openzeppelin-contracts-sol5/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts-sol5/token/ERC20/SafeERC20.sol";
import { SafeMath } from "openzeppelin-contracts-sol5/math/SafeMath.sol";

import { Initializable } from "@openzeppelin/upgrades/contracts/Initializable.sol";
import { InitializableGovernableWhitelist } from "@mstable/protocol/contracts/governance/InitializableGovernableWhitelist.sol";

contract MerkleDrop is Initializable, InitializableGovernableWhitelist {

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event Claimed(address claimant, uint256 week, uint256 balance);
    event TrancheAdded(uint256 tranche, bytes32 merkleRoot, uint256 totalAmount);
    event TrancheExpired(uint256 tranche);
    event RemovedFunder(address indexed _address);

    IERC20 public token;

    mapping(uint256 => bytes32) public merkleRoots;
    mapping(uint256 => mapping(address => bool)) public claimed;
    uint256 tranches;

    uint256 public thresholdBlock;

    function initialize(
        address _nexus,
        address[] calldata _funders,
        IERC20 _token,
        uint256 _thresholdBlock
    )
        external
        initializer
    {
        InitializableGovernableWhitelist._initialize(_nexus, _funders);
        token = _token;
        thresholdBlock = _thresholdBlock;
    }

    /***************************************
                    ADMIN
    ****************************************/

    function seedNewAllocations(bytes32 _merkleRoot, uint256 _totalAllocation)
        public
        onlyWhitelisted
        returns (uint256 trancheId)
    {
        token.safeTransferFrom(msg.sender, address(this), _totalAllocation);

        trancheId = tranches;
        merkleRoots[trancheId] = _merkleRoot;

        tranches = tranches.add(1);

        emit TrancheAdded(trancheId, _merkleRoot, _totalAllocation);
    }

    function expireTranche(uint256 _trancheId)
        public
        onlyWhitelisted
    {
        merkleRoots[_trancheId] = bytes32(0);

        emit TrancheExpired(_trancheId);
    }

    /**
     * @dev Allows the mStable governance to add a new Funder
     * @param _address  Funder to add
     */
    function addFunder(address _address)
        external
        onlyGovernor
    {
        _addWhitelist(_address);
    }

    /**
     * @dev Allows the mStable governance to remove inactive Funder
     * @param _address  Funder to remove
     */
    function removeFunder(address _address)
        external
        onlyGovernor
    {
        require(_address != address(0), "Address is zero");
        require(whitelist[_address], "Address is not whitelisted");

        whitelist[_address] = false;

        emit RemovedFunder(_address);
    }


    /***************************************
                  CLAIMING
    ****************************************/


    function claimTranche(
        address _liquidityProvider,
        uint256 _tranche,
        uint256 _balance,
        bytes32[] memory _merkleProof
    )
        public
    {
        require(block.number >= thresholdBlock, "Rewards are not yet claimable");
        _claimTranche(_liquidityProvider, _tranche, _balance, _merkleProof);
        _disburse(_liquidityProvider, _balance);
    }


    function verifyClaim(
        address _liquidityProvider,
        uint256 _tranche,
        uint256 _balance,
        bytes32[] memory _merkleProof
    )
        public
        view
        returns (bool valid)
    {
        return _verifyClaim(_liquidityProvider, _tranche, _balance, _merkleProof);
    }


    /***************************************
              CLAIMING - INTERNAL
    ****************************************/


    function _claimTranche(
        address _liquidityProvider,
        uint256 _tranche,
        uint256 _balance,
        bytes32[] memory _merkleProof
    )
        private
    {
        require(_tranche < tranches, "Week cannot be in the future");

        require(!claimed[_tranche][_liquidityProvider], "LP has already claimed");
        require(_verifyClaim(_liquidityProvider, _tranche, _balance, _merkleProof), "Incorrect merkle proof");

        claimed[_tranche][_liquidityProvider] = true;

        emit Claimed(_liquidityProvider, _tranche, _balance);
    }


    function _verifyClaim(
        address _liquidityProvider,
        uint256 _tranche,
        uint256 _balance,
        bytes32[] memory _merkleProof
    )
        private
        view
        returns (bool valid)
    {
        bytes32 leaf = keccak256(abi.encodePacked(_liquidityProvider, _balance));
        return MerkleProof.verify(_merkleProof, merkleRoots[_tranche], leaf);
    }


    function _disburse(address _liquidityProvider, uint256 _balance) private {
        if (_balance > 0) {
            token.safeTransfer(_liquidityProvider, _balance);
        } else {
            revert("No balance would be transferred - not going to waste your gas");
        }
    }
}
