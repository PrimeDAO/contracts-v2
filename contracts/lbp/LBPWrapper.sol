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
    address public admin;
    address public projectFeeBeneficiary;

    bool public poolFunded;
    bool public initialized;
    uint256 public projectFee;

    ILBP public lbp;

    modifier onlyAdmin() {
        require(msg.sender == admin, "LBPWrapper: admin owner function");
        _;
    }

    /**
     * @dev                             transfer ownership to new owner
     * @param _newAdmin                 new owner address
     */
    function transferAdminRights(address _newAdmin) external onlyAdmin {
        require(
            _newAdmin != address(0),
            "LBPWrapper: new owner cannot be zero"
        );
        admin = _newAdmin;
    }

    /**
     * @dev                             initialize lbp wrapper contract
     * @param _LBPFactory               LBP factory address
     * @param _name                     LBP name
     * @param _symbol                   LBP symbol
     * @param _tokens                   array of tokens sorted for the LBP
     * @param _weights                  array of start weights for respective tokens
     * @param _startTime                start time
     * @param _endTime                  end time
     * @param _endWeights               array of end weights for respective tokens
     * @param _projectFee               fee for providing the LBP service
     * @param _projectFeeBeneficiary    address who is the receiver of the _projectFee
     */
    function initializeLBP(
        address _LBPFactory,
        string memory _name,
        string memory _symbol,
        IERC20[] memory _tokens,
        uint256[] memory _weights,
        uint256 _startTime,
        uint256 _endTime,
        uint256[] memory _endWeights,
        uint256 _swapFeePercentage,
        uint256 _projectFee,
        address _projectFeeBeneficiary
    ) external returns (address) {
        require(!initialized, "LBPWrapper: already initialized");

        initialized = true;
        admin = msg.sender;
        projectFee = _projectFee;
        projectFeeBeneficiary = _projectFeeBeneficiary;

        lbp = ILBP(
            ILBPFactory(_LBPFactory).create(
                _name,
                _symbol,
                _tokens,
                _weights,
                _swapFeePercentage,
                address(this),
                false // swapEnabledOnStart is set to false at pool creation
            )
        );

        lbp.updateWeightsGradually(_startTime, _endTime, _endWeights);

        return address(lbp);
    }

    /**
     * @dev                             approve tokens for the vault and join pool to provide liquidity
     * @param _tokens                   array of tokens sorted for the LBP
     * @param _amounts                  amount of tokens to add to the pool to provide liquidity
     * @param _receiver                 address who will receive the Balancer Pool Tokens (BPT)
     * @param _fromInternalBalance      fund tokens from the internal user balance
     * @param _userData                 userData specifies the type of join
     */
    function fundPool(
        IERC20[] memory _tokens,
        uint256[] memory _amounts,
        address _receiver,
        bool _fromInternalBalance,
        bytes memory _userData
    ) public onlyAdmin {
        require(!poolFunded, "LBPWrapper: pool has already been funded");

        IVault vault = lbp.getVault();

        if (!_fromInternalBalance) {
            for (uint8 i; i < _tokens.length; i++) {
                _tokens[i].approve(address(vault), _amounts[i]);
            }
        }

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
            maxAmountsIn: _amounts,
            userData: _userData,
            fromInternalBalance: _fromInternalBalance,
            assets: _tokens
        });

        vault.joinPool(lbp.getPoolId(), address(this), _receiver, request);

        poolFunded = true;
        setPaused(false);
    }

    /**
     * @dev                             can pause/unpause trading
     * @param _isPaused                 enable/disable swapping
     */
    function setPaused(bool _isPaused) public onlyAdmin {
        lbp.setSwapEnabled(!_isPaused);
    }

    /**
     * @dev                             checks if swap is enabled or not
     */
    function paused() public view returns (bool) {
        return !lbp.getSwapEnabled();
    }

    /**
     * @dev                             gets the swapFeePercentage from the pool
     */
    function getSwapFeePercentage() public view returns (uint256) {
        return lbp.getSwapFeePercentage();
    }
}
