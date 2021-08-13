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
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../utils/CloneFactory.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "./LBPWrapper.sol";
import "hardhat/console.sol";


contract WrapperFactory is CloneFactory, Ownable {

    address public wrapperMasterCopy;

    address public LBPFactory;
    uint256 public swapFeePercentage;
    bool public isInitialized;

    event LBPDeployedUsingWrapper(address indexed lbp, address indexed wrapper, address indexed admin);

    /**
     * @dev                       constructor
     * @param _LBPFactory         address of lbp factory
     * @param _swapFeePercentage  swap fee percentage
     */
    constructor (
            address _LBPFactory,
            uint256 _swapFeePercentage
    ) {
        LBPFactory = _LBPFactory;
        swapFeePercentage = _swapFeePercentage;
        isInitialized = true;
    }

    /**
     * @dev                set new master copy of LBP wrapper
     * @param _masterCopy  address of master copy
     */
    function setMasterCopy(address _masterCopy) public onlyOwner{
        require(
            _masterCopy != address(0),
            "WrapperFactory: mastercopy cannot be zero"
        );
        require(
            _masterCopy != address(this),
            "WrapperFactory: mastercopy cannot be the same as WrapperFactory"
        );
        wrapperMasterCopy = _masterCopy;
    }

    /**
     * @dev                        initialize lbp wrapper contract
     * @param _name                LBP name
     * @param _symbol              LBP symbol
     * @param _tokens              array of tokens sorted for the LBP
     * @param _amounts             array of initial amounts used to join pool
     * @param _weights             array of start weights for respective tokens
     * @param _swapEnabledOnStart  enable or disable swap
     * @param _startTime           start time
     * @param _endTime             end time
     * @param _endWeights          array of end weights for respective tokens
     * @param _admin               address of admin/owner of LBP
     * @param _userData            extra data required by LBP
     */
    function deployLBPUsingWrapper(
        string memory _name,
        string memory _symbol,
        IERC20[] memory _tokens,
        uint256[] memory _amounts,
        uint256[] memory _weights,
        bool _swapEnabledOnStart,
        uint256 _startTime,
        uint256 _endTime,
        uint256[] memory _endWeights,
        address _admin,
        bytes memory _userData
    ) public onlyOwner
    {
        address wrapper = createClone(wrapperMasterCopy);

        LBPWrapper(wrapper).initialize(LBPFactory, swapFeePercentage);

        for (uint i; i < _tokens.length; i++) {
            IERC20(_tokens[i]).transferFrom(_admin, wrapper, _amounts[i]);
        }

        address lbp = LBPWrapper(wrapper).deployLbpFromFactory(
            _name,
            _symbol,
            _tokens,
            _amounts,
            _weights,
            _swapEnabledOnStart,
            _startTime,
            _endTime,
            _endWeights,
            _admin,
            _userData
        );

        LBPWrapper(wrapper).transferOwnership(_admin);

        emit LBPDeployedUsingWrapper(lbp, wrapper, _admin);
    }

}