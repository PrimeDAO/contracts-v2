/*

██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░

*/

// SPDX-License-Identifier: GPL-3.0-or-later

// solium-disable linebreak-style
pragma solidity ^0.8.6;

import "../utils/CloneFactory.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./LBPManager.sol";

/**
 * @title PrimeDAO LBPManager Factory
 * @dev   Enable PrimeDAO governance to create new LBPManager contracts.
 */
contract LBPManagerFactory is CloneFactory, Ownable {
    address public masterCopy;
    address public LBPFactory;

    event LBPDeployedUsingManager(
        address indexed lbp,
        address indexed lbpManager,
        address indexed admin
    );

    /**
     * @dev                             Constructor.
     * @param _LBPFactory               The address of Balancers LBP factory.
     */
    constructor(address _LBPFactory) {
        require(
            _LBPFactory != address(0),
            "LBPManagerFactory: LBPFactory can not be zero"
        );
        LBPFactory = _LBPFactory;
    }

    modifier validAddress(address addressToCheck) {
        require(
            addressToCheck != address(0),
            "LBPManagerFactory: address can not be zero"
        );
        require(
            addressToCheck != address(this),
            "LBPManagerFactory: address can not be the same as LBPManagerFactory"
        );
        _;
    }

    /**
     * @dev                             Set LBPManager contract which works as a base for clones.
     * @param _masterCopy               The address of the new LBPManager basis.
     */
    function setMasterCopy(address _masterCopy)
        external
        onlyOwner
        validAddress(_masterCopy)
    {
        masterCopy = _masterCopy;
    }

    /**
     * @dev                             Set Balancers LBP Factory contract as basis for deploying LBPs.
     * @param _LBPFactory               The address of Balancers LBP factory.
     */
    function setLBPFactory(address _LBPFactory)
        external
        onlyOwner
        validAddress(_LBPFactory)
    {
        LBPFactory = _LBPFactory;
    }

    /**
     * @dev                             Deploy and initialize LBPManager.
     * @param _admin                    The address of the admin of the LBPManager.
     * @param _beneficiary              The address that receives the _primeDaoFeePercentage.
     * @param _name                     Name of the LBP.
     * @param _symbol                   Symbol of the LBP.
     * @param _tokenList                Numerically sorted array (ascending) containing two addresses:
                                            - The address of the project token being distributed.
                                            - The address of the funding token being exchanged for the project token.
     * @param _amounts                  Sorted array to match the _tokenList, containing two parameters:
                                            - The amounts of project token to be added as liquidity to the LBP.
                                            - The amounts of funding token to be added as liquidity to the LBP.
     * @param _weights                  Sorted array to match the _tokenList, containing two parametes:
                                            - The start weight for the project token in the LBP.
                                            - The start weight for the funding token in the LBP.
     * @param _startTimeEndtime         Array containing two parameters:
                                            - Start time for the LBP.
                                            - End time for the LBP.
     * @param _endWeights               Sorted array to match the _tokenList, containing two parametes:
                                            - The end weight for the project token in the LBP.
                                            - The end weight for the funding token in the LBP.
     * @param _swapFeePercentage        Percentage of fee paid for every swap in the LBP.
     * @param _primeDaoFeePercentage    Percentage of fee paid to PrimeDao for providing the service of the LBP Manager.
     */
    function deployLBPUsingManager(
        address _admin,
        address _beneficiary,
        string memory _name,
        string memory _symbol,
        IERC20[] memory _tokenList,
        uint256[] memory _amounts,
        uint256[] memory _weights,
        uint256[] memory _startTimeEndtime,
        uint256[] memory _endWeights,
        uint256 _swapFeePercentage,
        uint256 _primeDaoFeePercentage
    ) external onlyOwner {
        require(
            masterCopy != address(0),
            "LBPManagerFactory: LBPManager mastercopy is not set"
        );

        address lbpManager = createClone(masterCopy);

        address lbp = LBPManager(lbpManager).initializeLBP(
            LBPFactory,
            _beneficiary,
            _name,
            _symbol,
            _tokenList,
            _amounts,
            _weights,
            _startTimeEndtime,
            _endWeights,
            _swapFeePercentage,
            _primeDaoFeePercentage
        );

        LBPManager(lbpManager).transferAdminRights(_admin);

        emit LBPDeployedUsingManager(lbp, lbpManager, _admin);
    }
}