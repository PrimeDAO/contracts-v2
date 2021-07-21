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


import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./interface/ILBPFactory";
import "ILBP";


contract LBPDeployer{

    address public safe;
    address public LBPFactory;
    uint256 public swapFeePercentage;
    bool isInitialized;

    modifier onlySafe{
        require(
            msg.sender == safe,
            "Deployer: only safe function"
        );
        _;
    }

    modifier initialized {
        require(
            isInitialized,
            "Deploter: contract not initialized"
            );
    }

    constructor (
            address _LBPFactory,
            uint256 _swapFeePercentage
        ) {

        LBPFactory = _LBPFactory;
        swapFeePercentage = _swapFeePercentage;
        safe = msg.sender;
        isInitialized = true;
    }

    function deployLbpFromFactory(
            string memory _name,
            string memory _symbol,
            IERC20[] memory _tokens,
            uint256[] memory _weights,
            address _owner,
            bool _swapEnabledOnStart,
            uint256 _startTime,
            uint256 _endTime,
            uint256[] memory _endWeights
        ) public onlySafe {
        address lbp = ILBPFactory(LBPFactory).create(
                _name,
                _symbol,
                _tokens,
                _weights,
                swapFeePercentage,
                _owner,
                _swapEnabledOnStart
            );
        ILBP(lbp).updateWeightsGradually(
                _startTime,
                _endTime,
                _endWeights
            );
    }

    function setSwapFeePercentage(uint256 _swapFeePercentage) public onlySafe {
        swapFeePercentage = _swapFeePercentage;
    }

    function setLBPFactory(address _LBPFactory) public onlySafe {
        LBPFactory = _LBPFactory;
    }

}