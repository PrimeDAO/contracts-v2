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
import "../utils/interface/ILBPFactory.sol";
import "../utils/interface/ILBP.sol";


contract LBPWrapper {

    address public owner;
    address public LBPFactory;
    address public lbp;
    uint256 public swapFeePercentage;
    bool isInitialized;

    modifier onlyOwner{
        require(msg.sender == owner, "LBPWrapper: only owner function");
        _;
    }

    function transferOwnership(address _newOwner) public onlyOwner{
        require(_newOwner != address(0), "LBPWrapper: new owner cannot be zero");
        owner = _newOwner;
    }

    function initialize (
            address _LBPFactory,
            uint256 _swapFeePercentage
    ) public
    {
        owner = msg.sender;
        LBPFactory = _LBPFactory;
        swapFeePercentage = _swapFeePercentage;
        isInitialized = true;
    }

    function deployLbpFromFactory(
            string memory _name,
            string memory _symbol,
            IERC20[] memory _tokens,
            uint256[] memory _weights,
            bool _swapEnabledOnStart,
            uint256 _startTime,
            uint256 _endTime,
            uint256[] memory _endWeights
    ) public onlyOwner returns(address)
    {
        address lbp = ILBPFactory(LBPFactory).create(
                _name,
                _symbol,
                _tokens,
                _weights,
                swapFeePercentage,
                address(this),
                _swapEnabledOnStart
            );
        ILBP(lbp).updateWeightsGradually(
                _startTime,
                _endTime,
                _endWeights
            );
        return lbp;
    }

    function setSwapFeePercentage(uint256 _swapFeePercentage) public onlyOwner {
        swapFeePercentage = _swapFeePercentage;
    }

    function setLBPFactory(address _LBPFactory) public onlyOwner {
        LBPFactory = _LBPFactory;
    }

}