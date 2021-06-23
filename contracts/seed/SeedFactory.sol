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
// solium-disable linebreak-style
pragma solidity 0.8.4;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./Seed.sol";
import "../utils/CloneFactory.sol";

/**
 * @title PrimeDAO Seed Factory
 * @dev   Enable PrimeDAO governance to create new Seed contracts.
 */
contract SeedFactory is CloneFactory, Ownable {

    Seed public masterCopy;

    event SeedCreated(address indexed newSeed, address indexed beneficiary);

    /**
     * @dev               Set Seed contract which works as a base for clones.
     * @param _masterCopy The address of the new Seed basis.
     */
    function setMasterCopy(Seed _masterCopy) public onlyOwner {
        require(address(_masterCopy) != address(0), "SeedFactory: new mastercopy cannot be zero address");
        masterCopy = _masterCopy; 
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
      * @param _price                 1 Funding Token = _price amount of Seed Token. 
      * @param _startTime             Distribution start time in unix timecode.
      * @param _endTime               Distribution end time in unix timecode.
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
        uint256 _price,
        uint256 _startTime,
        uint256 _endTime,
        uint32 _vestingDuration,
        uint32 _vestingCliff,
        bool _permissionedSeed,
        uint8 _fee,
        bytes memory _metadata
    ) public onlyOwner returns (address) {
        {
            require(address(masterCopy) != address(0), "SeedFactory: mastercopy cannot be zero address");

            // parameter check
            require(_tokens[0] != _tokens[1], "SeedFactory: seedToken cannot be fundingToken");
            require(_softHardThresholds[1] >= _softHardThresholds[0],"SeedFactory: hardCap cannot be less than softCap");
            require(_vestingDuration >= _vestingCliff, "SeedFactory: vestingDuration cannot be less than vestingCliff");
            require(_endTime > _startTime, "SeedFactory: endTime cannot be less than equal to startTime");
        }

        // deploy clone
        address _newSeed = createClone(address(masterCopy));

        Seed(_newSeed).updateMetadata(_metadata);

        // initialize
        Seed(_newSeed).initialize(
            _beneficiary,
            _admin,
            _tokens,
            _softHardThresholds,
            _price,
            _startTime,
            _endTime,
            _vestingDuration,
            _vestingCliff,
            _permissionedSeed,
            _fee
        );

        emit SeedCreated(address(_newSeed), msg.sender);

        return _newSeed;
    }
}
