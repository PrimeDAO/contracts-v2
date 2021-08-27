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

    address public owner;
    ILBPFactory public LBPFactory;
    address public lbp;
    uint256 public swapFeePercentage;
    bool isInitialized;

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
     * @param _swapFeePercentage  swap fee percentage
     */
    function initialize (
            address _LBPFactory,
            uint256 _swapFeePercentage
    ) public
    {
        owner = msg.sender;
        LBPFactory = ILBPFactory(_LBPFactory);
        swapFeePercentage = _swapFeePercentage;
        isInitialized = true;
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
    function deployLbpFromFactory(
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
    ) public onlyOwner returns(address)
    {
        // to handle stack overflow
        {
            address vault = address(LBPFactory.getVault());
            for ( uint8 i; i < _tokens.length; i++ ) {
                IERC20(_tokens[i]).approve(vault, _amounts[i]);
            }
        }

        lbp = LBPFactory.create(
                _name,
                _symbol,
                _tokens,
                _weights,
                swapFeePercentage,
                address(this),
                _swapEnabledOnStart
            );

        // to handle stack overflow
        {
            ILBP(lbp).updateWeightsGradually(
                _startTime,
                _endTime,
                _endWeights
            );
        }

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
            maxAmountsIn: _amounts,
            userData: _userData,
            fromInternalBalance: false,
            assets: _tokens
        });

        // // to handle stack overflow
        {
            address vault = address(LBPFactory.getVault());
            IVault(vault).joinPool(
                ILBP(lbp).getPoolId(),
                address(this),
                _admin,
                request
            );
        }

        return lbp;
    }

    /**
     * @dev                       set new swap fee percentage
     * @param _swapFeePercentage  swap fee percentage
     */
    function setSwapFeePercentage(uint256 _swapFeePercentage) public onlyOwner {
        swapFeePercentage = _swapFeePercentage;
    }

}