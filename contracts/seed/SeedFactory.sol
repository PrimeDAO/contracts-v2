/*

██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░

*/

// SPDX-License-Identifier: GPL-3.0-or-later
/* solhint-disable space-after-comma */
pragma solidity 0.8.4;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./Seed.sol";
import "../utils/CloneFactory.sol";
import "../ISafe.sol";

/**
 * @title primeDAO Seed Factory
 * @dev   Enable primeDAO governance to create new Seed contracts.
 */
contract SeedFactory is CloneFactory, Ownable {

    Seed public masterCopy;
    bool public initialized;

    ISafe public safe;

    event SeedCreated(address indexed newSeed, address indexed beneficiary);

    modifier initializer() {
        require(!initialized, "SeedFactory: contract already initialized");
        initialized = true;
        _;
    }

    modifier isInitialised() {
        require(initialized, "SeedFactory: contract not initialized");
        _;
    }

    /**
     * @dev               Initialize SeedFactory.
     * @param _masterCopy The address of the Seed contract which will be a masterCopy for all of the clones.
     */
    function initializeMasterCopy(Seed _masterCopy) external initializer onlyOwner {
        require(address(_masterCopy) != address(0),   "SeedFactory: masterCopy cannot be null");
        masterCopy = _masterCopy;
    }

    /**
     * @dev               Update Seed contract which works as a base for clones.
     * @param _masterCopy The address of the new Seed basis.
     */
    function changeMasterCopy(Seed _masterCopy) public onlyOwner {
        masterCopy = _masterCopy;
        initialized = true;
    }

    /**
      * @dev                          Deploys Seed contract.
      * @param _beneficiary           The address that recieves fees.
      * @param _admin                 The address of the admin of this contract. Funds contract
                                      and has permissions to whitelist users, pause and close contract.
      * @param _tokens                Array containing two params:
                                        - The address of the seed token being distributed.
      *                                 - The address of the funding token being exchanged for seed token.
      * @param _softHardThresholds     Array containing two params:
                                        - the minimum funding token collection threshold in wei denomination.
                                        - the highest possible funding token amount to be raised in wei denomination.
      * @param _endStartTime          Array containing two params:
      *                                 - Distribution start time in unix timecode.
                                        - Distribution end time in unix timecode.
      * @param _price                 The price in wei of fundingTokens when exchanged for seedTokens.
      * @param _vestingDuration       Vesting period duration in days.
      * @param _vestingCliff          Cliff duration in days.
      * @param _permissionedSeed         Set to true if only whitelisted adresses are allowed to participate.
      * @param _fee                   Success fee expressed in Wei as a % (e.g. 2 = 2% fee)
      * @param _metadata              Seed contract metadata, that is IPFS URI
    */
    function deploySeed(
        address _beneficiary,
        address _admin,
        address[] memory _tokens,
        uint256[] memory _softHardThresholds,
        uint256[] memory _endStartTime,
        uint256 _price,
        uint32 _vestingDuration,
        uint32 _vestingCliff,
        bool _permissionedSeed,
        uint8 _fee,
        bytes32 _metadata
    ) public onlyOwner isInitialised returns (address) {
        // deploy clone
        address _newSeed = createClone(address(masterCopy));

        Seed(_newSeed).updateMetadata(_metadata);

        // initialize
        Seed(_newSeed).initialize(
            _beneficiary,
            _admin,
            _tokens,
            _softHardThresholds,
            _endStartTime,
            _price,
            _vestingDuration,
            _vestingCliff,
            _permissionedSeed,
            _fee
        );

        emit SeedCreated(address(_newSeed), msg.sender);

        return address(_newSeed);
    }

    /**
      * @dev                          Set safe address.
      * @param _safe                  The address os safe.
    */
    function setSafe(ISafe _safe) public {
        safe = _safe;
    }

    /**
      * @dev                          Deploys Seed contract from safe without any confirmation.
      * @param _admin                 The address of the admin of this contract. Funds contract
                                      and has permissions to whitelist users, pause and close contract.
      * @param _tokens                Array containing two params:
                                        - The address of the seed token being distributed.
      *                                 - The address of the funding token being exchanged for seed token.
      * @param _softHardThresholds     Array containing two params:
                                        - the minimum funding token collection threshold in wei denomination.
                                        - the highest possible funding token amount to be raised in wei denomination.
      * @param _price                 The price in wei of fundingTokens when exchanged for seedTokens.
      * @param _startTime             Distribution start time in unix timecode.
      * @param _endTime               Distribution end time in unix timecode.
      * @param _vestingDuration       Vesting period duration in days.
      * @param _vestingCliff          Cliff duration in days.
      * @param _isWhitelisted         Set to true if only whitelisted adresses are allowed to participate.
      * @param _fee                   Success fee expressed in Wei as a % (e.g. 2 = 2% fee)
      * @param _metadata              Seed contract metadata, that is IPFS URI
    */
    function deployFromModule(
        address _admin,
        address[] memory _tokens,
        uint256[] memory _softHardThresholds,
        uint256 _price,
        uint256 _startTime,
        uint256 _endTime,
        uint32 _vestingDuration,
        uint32 _vestingCliff,
        bool _isWhitelisted,
        uint8 _fee,
        bytes32 _metadata
    ) public {
        bytes memory data = abi.encodeWithSignature(
            "deploySeed()",
            address(safe),
            _admin,
            _tokens,
            _softHardThresholds,
            _price,
            _startTime,
            _endTime,
            _vestingDuration,
            _vestingCliff,
            _isWhitelisted,
            _fee,
            _metadata);
        require(safe.execTransactionFromModule(address(this), 0, data, Enum.Operation.Call), "Failed");
    }

    /**
      * @dev                        Create safe transaction to deploy seed.
      * @param _to                  The address of SeedFactory.
      * @param _value               value to be transferred.
      * @param _operation           Operation type of Safe transaction.
      * @param _safeTxGas           Gas that should be used for the Safe transaction.
      * @param _baseGas             Gas costs that are independent of the transaction execution(e.g. base transaction fee, signature check, payment of the refund)
      * @param _gasPrice            Gas price that should be used for the payment calculation.
      * @param _gasToken            Token address (or 0 if ETH) that is used for the payment.
      * @param _refundReceiver      Address of receiver of gas payment (or 0 if tx.origin).
      * @param _signatures          Packed signature data ({bytes32 r}{bytes32 s}{uint8 v})
    */
    // This can be done directly on the dapp, that is invoke exectransaction directly at safe.
    function createSafeTransaction(
        address _to,
        uint256 _value,
        Enum.Operation _operation,
        uint256 _safeTxGas,
        uint256 _baseGas,
        uint256 _gasPrice,
        address _gasToken,
        address payable _refundReceiver,
        bytes memory _signatures
    ) public {
        bytes memory data = abi.encodeWithSignature("deploySeed()");
        require(safe.execTransaction( _to,
                                      _value,
                                      data,
                                      _operation,
                                      _safeTxGas,
                                      _baseGas,
                                      _gasPrice,
                                      _gasToken,
                                      _refundReceiver,
                                      _signatures), "Failed");
    }
}
