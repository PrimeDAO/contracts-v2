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

    uint256 public swapFeePercentage;

    event LBPDeployedUsingWrapper(
        address indexed lbp,
        address indexed wrapper,
        address indexed admin
    );

    /**
     * @dev                       constructor
     * @param _LBPFactory         address of lbp factory
     */
    constructor(address _LBPFactory, uint256 _swapFeePercentage) {
        require(
            _swapFeePercentage >= 1e12 && _swapFeePercentage <= 1e17,
            "LBPWrapper: swap fee has to be >= 0.0001% and <= 10% for the LBP"
        );
        LBPFactory = _LBPFactory;
        swapFeePercentage = _swapFeePercentage;
    }

    /**
     * @dev                         set new master copy of LBP wrapper
     * @param _masterCopy           address of master copy
     */
    function setMasterCopy(address _masterCopy) external onlyOwner {
        require(
            _masterCopy != address(0),
            "LBPWrapperFactory: mastercopy cannot be zero"
        );
        require(
            _masterCopy != address(this),
            "LBPWrapperFactory: mastercopy cannot be the same as LBPWrapperFactory"
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
            "LBPWrapperFactory: LBPFactory cannot be zero"
        );
        require(
            _LBPFactory != address(this),
            "LBPWrapperFactory: LBPFactory cannot be the same as LBPWrapperFactory"
        );
        LBPFactory = _LBPFactory;
    }

    /**
     * @dev                         set swapFeePercentage for the LBP
     * @param _swapFeePercentage    value to be set as fee
     */
    function setSwapFeePercentage(uint256 _swapFeePercentage)
        external
        onlyOwner
    {
        require(
            _swapFeePercentage >= 1e12 && _swapFeePercentage <= 1e17,
            "LBPWrapper: swap fee has to be >= 0.0001% and <= 10% for the LBP"
        );
        swapFeePercentage = _swapFeePercentage;
    }

    /**
     * @dev                         initialize lbp wrapper contract
     * @param _name                 LBP name
     * @param _symbol               LBP symbol
     * @param _tokens               array of tokens sorted for the LBP
     * @param _weights              array of start weights for respective tokens
     * @param _startTime            start time
     * @param _endTime              end time
     * @param _endWeights           array of end weights for respective tokens
     * @param _admin                address of admin/owner of LBP
     */
    function deployLBPUsingWrapper(
        string memory _name,
        string memory _symbol,
        IERC20[] memory _tokens,
        uint256[] memory _weights,
        uint256 _startTime,
        uint256 _endTime,
        uint256[] memory _endWeights,
        address _admin
    ) external onlyOwner {
        require(
            wrapperMasterCopy != address(0),
            "LBPWrapperFactory: LBPWrapper mastercopy is not set"
        );
        address wrapper = createClone(wrapperMasterCopy);

        address lbp = LBPWrapper(wrapper).initializeLBP(
            LBPFactory,
            _name,
            _symbol,
            _tokens,
            _weights,
            _startTime,
            _endTime,
            _endWeights,
            swapFeePercentage
        );

        LBPWrapper(wrapper).transferOwnership(_admin);

        emit LBPDeployedUsingWrapper(lbp, wrapper, _admin);
    }
}
