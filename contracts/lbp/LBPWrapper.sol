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
    uint256 public constant SWAP_FEE_PERCENTAGE = 1e12; // 0.0001% is minimum amount.

    address public owner;
    bool public isPoolFunded;
    bool public isInitialized;
    bool public isPaused;

    ILBP public lbp;

    modifier onlyOwner() {
        require(msg.sender == owner, "LBPWrapper: only owner function");
        _;
    }

    /**
     * @dev              transfer ownership to new owner
     * @param _newOwner  new owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(
            _newOwner != address(0),
            "LBPWrapper: new owner cannot be zero"
        );
        owner = _newOwner;
    }

    /**
     * @dev                        initialize lbp wrapper contract
     * @param _LBPFactory          LBP factory address
     * @param _name                LBP name
     * @param _symbol              LBP symbol
     * @param _tokens              array of tokens sorted for the LBP
     * @param _weights             array of start weights for respective tokens
     * @param _startTime           start time
     * @param _endTime             end time
     * @param _endWeights          array of end weights for respective tokens
     */
    function initializeLBP(
        address _LBPFactory,
        string memory _name,
        string memory _symbol,
        IERC20[] memory _tokens,
        uint256[] memory _weights,
        uint256 _startTime,
        uint256 _endTime,
        uint256[] memory _endWeights
    ) external returns (address) {
        require(!isInitialized, "LBPWrapper: already initialized");
        isInitialized = true;
        owner = msg.sender;

        lbp = ILBP(
            ILBPFactory(_LBPFactory).create(
                _name,
                _symbol,
                _tokens,
                _weights,
                SWAP_FEE_PERCENTAGE,
                address(this),
                false // setSwapEnabled at pool creation to false
            )
        );

        lbp.updateWeightsGradually(_startTime, _endTime, _endWeights);

        return address(lbp);
    }

    /**
     * @dev                          approve tokens for the vault and join pool to provide liquidity
     * @param _tokens                array of tokens sorted for the LBP
     * @param _amounts               amount of tokens to add to the pool to provide liquidity
     * @param _receiver              address who will receive the Balancer Pool Tokens (BPT)
     * @param _fromInternalBalance   fund tokens from the internal user balance
     * @param _userData              userData specifies the type of join
     */
    function fundPool(
        IERC20[] memory _tokens,
        uint256[] memory _amounts,
        address _receiver,
        bool _fromInternalBalance,
        bytes memory _userData
    ) external onlyOwner {
        require(!isPoolFunded, "LBPWrapper: pool has already been funded");

        setPause(false); // unpauses the pool to add funds

        IVault vault = lbp.getVault();
        for (uint8 i; i < _tokens.length; i++) {
            _tokens[i].approve(address(vault), _amounts[i]);
        }

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
            maxAmountsIn: _amounts,
            userData: _userData,
            fromInternalBalance: _fromInternalBalance,
            assets: _tokens
        });

        vault.joinPool(lbp.getPoolId(), address(this), _receiver, request);

        isPoolFunded = true;
    }

    /**
     * @dev                     can pause/unpause trading
     * @param _isPaused         enable/disable swapping
     */
    function setPause(bool _isPaused) public onlyOwner {
        isPaused = _isPaused;
        _isPaused = _isPaused ? false : true; // setSwapEnabled requires opposite bool

        lbp.setSwapEnabled(_isPaused);
    }
}
