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

contract LBPManagerFactory is CloneFactory, Ownable {
    address public lbpManagerMasterCopy;
    address public LBPFactory;

    event LBPDeployedUsingManager(
        address indexed lbp,
        address indexed lbpManager,
        address indexed admin
    );

    /**
     * @dev                             constructor
     * @param _LBPFactory               address of lbp factory
     */
    constructor(address _LBPFactory) {
        require(
            _LBPFactory != address(0),
            "LBPManagerFactory: LBPFactory can not be zero"
        );
        LBPFactory = _LBPFactory;
    }

    /**
     * @dev                             set new master copy of LBP manager
     * @param _masterCopy               address of master copy
     */
    function setMasterCopy(address _masterCopy) external onlyOwner {
        require(
            _masterCopy != address(0),
            "LBPManagerFactory: mastercopy can not be zero"
        );
        require(
            _masterCopy != address(this),
            "LBPManagerFactory: mastercopy can not be the same as LBPManagerFactory"
        );
        lbpManagerMasterCopy = _masterCopy;
    }

    /**
     * @dev                         set new master copy of Balancer LBP Factory
     * @param _LBPFactory           address of LBP factory
     */
    function setLBPFactory(address _LBPFactory) external onlyOwner {
        require(
            _LBPFactory != address(0),
            "LBPManagerFactory: LBPFactory can not be zero"
        );
        require(
            _LBPFactory != address(this),
            "LBPManagerFactory: LBPFactory can not be the same as LBPManagerFactory"
        );
        LBPFactory = _LBPFactory;
    }

    /**
     * @dev                             initialize lbp manager contract
     * @param _name                     LBP name
     * @param _symbol                   LBP symbol
     * @param _tokens                   array of tokens sorted for the LBP
     * @param _amounts                  array of amounts of tokens that needs to be added as liquidity
     * @param _weights                  array of start weights for respective tokens
     * @param _startTimeEndtime         array of start time and end time
     * @param _endWeights               array of end weights for respective tokens
     * @param _admin                    address of admin/owner of LBP
     * @param _swapFeePercentage        value to be set as swap fee in the pool
     * @param _primeDaoFeePercentage    fee percentage for providing the LBP service
     * @param _beneficiary              address who is the receiver of the primeDaoFeePercentage
     */
    function deployLBPUsingManager(
        address _admin,
        address _beneficiary,
        string memory _name,
        string memory _symbol,
        IERC20[] memory _tokens,
        uint256[] memory _amounts,
        uint256[] memory _weights,
        uint256[] memory _startTimeEndtime,
        uint256[] memory _endWeights,
        uint256 _swapFeePercentage,
        uint256 _primeDaoFeePercentage
    ) external onlyOwner {
        require(
            lbpManagerMasterCopy != address(0),
            "LBPManagerFactory: LBPManager mastercopy is not set"
        );

        address lbpManager = createClone(lbpManagerMasterCopy);

        address lbp = LBPManager(lbpManager).initializeLBP(
            LBPFactory,
            _beneficiary,
            _name,
            _symbol,
            _tokens,
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
