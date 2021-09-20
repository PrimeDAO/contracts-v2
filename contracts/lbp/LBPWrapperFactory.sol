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
import "./LBPWrapper.sol";

contract LBPWrapperFactory is CloneFactory, Ownable {
    address public wrapperMasterCopy;
    address public LBPFactory;

    event LBPDeployedUsingWrapper(
        address indexed lbp,
        address indexed wrapper,
        address indexed admin
    );

    /**
     * @dev                             constructor
     * @param _LBPFactory               address of lbp factory
     */
    constructor(address _LBPFactory) {
        require(
            _LBPFactory != address(0),
            "LBPWrapperFactory: LBPFactory can not be zero"
        );
        LBPFactory = _LBPFactory;
    }

    /**
     * @dev                             set new master copy of LBP wrapper
     * @param _masterCopy               address of master copy
     */
    function setMasterCopy(address _masterCopy) external onlyOwner {
        require(
            _masterCopy != address(0),
            "LBPWrapperFactory: mastercopy can not be zero"
        );
        require(
            _masterCopy != address(this),
            "LBPWrapperFactory: mastercopy can not be the same as LBPWrapperFactory"
        );
        wrapperMasterCopy = _masterCopy;
    }

    /**
     * @dev                         set new master copy of Balancer LBP Factory
     * @param _LBPFactory           address of LBP factory
     */
    function setLBPFactory(address _LBPFactory) external onlyOwner {
        require(
            _LBPFactory != address(0),
            "LBPWrapperFactory: LBPFactory can not be zero"
        );
        require(
            _LBPFactory != address(this),
            "LBPWrapperFactory: LBPFactory can not be the same as LBPWrapperFactory"
        );
        LBPFactory = _LBPFactory;
    }

    /**
     * @dev                             initialize lbp wrapper contract
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
    function deployLBPUsingWrapper(
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
            wrapperMasterCopy != address(0),
            "LBPWrapperFactory: LBPWrapper mastercopy is not set"
        );

        address wrapper = createClone(wrapperMasterCopy);

        address lbp = LBPWrapper(wrapper).initializeLBP(
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

        LBPWrapper(wrapper).transferAdminRights(_admin);

        emit LBPDeployedUsingWrapper(lbp, wrapper, _admin);
    }
}
