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

/**
 * @title primeDAO Seed Factory
 * @dev   Enable primeDAO governance to create new Seed contracts.
 */
contract SeedFactory is CloneFactory, Ownable {

    Seed public masterCopy;
    bool public initialized;

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
}
