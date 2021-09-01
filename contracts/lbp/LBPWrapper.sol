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
pragma solidity 0.8.6;


import "openzeppelin-contracts-sol8/token/ERC20/IERC20.sol";
import "../utils/interface/ILBPFactory.sol";
import "../utils/interface/IVault.sol";
import "../utils/interface/ILBP.sol";



contract LBPWrapper {

    ILBPFactory public LBPFactory;
    bool isInitialized;
    address public owner;
    address public lbp;
    uint256 constant public swapFeePercentage = 1e12; // 0.0001% is minimum amount.

    modifier onlyOwner{
        require(msg.sender == owner, "LBPWrapper: only owner function");
        _;
    }

    /**
     * @dev              transfer ownership to new owner
     * @param _newOwner  new owner address
     */
    function transferOwnership(address _newOwner) public onlyOwner{
        require(_newOwner != address(0), "LBPWrapper: new owner cannot be zero");
        owner = _newOwner;
    }

    /**
     * @dev                       initialize lbp wrapper contract
     * @param _LBPFactory         LBP factory address
     */
    function initialize (
            address _LBPFactory
    ) public
    {
        owner = msg.sender;
        LBPFactory = ILBPFactory(_LBPFactory);
        isInitialized = true;
    }

    /**
     * @dev                        initialize lbp wrapper contract
     * @param _name                LBP name
     * @param _symbol              LBP symbol
     * @param _tokens              array of tokens sorted for the LBP
     * @param _weights             array of start weights for respective tokens
     * @param _swapEnabledOnStart  enable or disable swap
     * @param _startTime           start time
     * @param _endTime             end time
     * @param _endWeights          array of end weights for respective tokens
     */
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

        lbp = LBPFactory.create(
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


    function addLiquidityToLbp(
        IERC20[] memory _tokens,
        bool _formInternalBalance,
        bytes memory _userData,
        uint256[] memory _amounts
        ) public onlyOwner {

        address vault = address(LBPFactory.getVault());
        for ( uint8 i; i < _tokens.length; i++ ) {
            IERC20(_tokens[i]).approve(vault, _amounts[i]);
        }

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
            maxAmountsIn: _amounts,
            userData: _userData,
            fromInternalBalance: _formInternalBalance,
            assets: _tokens
        });

        IVault(vault).joinPool(
            ILBP(lbp).getPoolId(),
            address(this),
            address(this),
            request
        );
    }
}