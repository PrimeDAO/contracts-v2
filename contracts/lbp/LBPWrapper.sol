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
import "hardhat/console.sol"; // <<<<<<<<<<<<<<< Remove

contract LBPWrapper {
    address public admin;
    address public primeDaoAddress;

    bool public poolFunded;
    bool public initialized;
    uint256 public primeDaoFeePercentage;

    uint256 private constant HUNDRED_PERCENT = 10e18;

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
     * @param _primeDaoFeePercentage    fee percentage for providing the LBP service
     * @param _primeDaoAddress          address who is the receiver of the _primeDaoFeePercentage
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
        uint256 _primeDaoFeePercentage,
        address _primeDaoAddress
    ) external returns (address) {
        require(!initialized, "LBPWrapper: already initialized");

        initialized = true;
        admin = msg.sender;
        primeDaoFeePercentage = _primeDaoFeePercentage;
        primeDaoAddress = _primeDaoAddress;

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
        } else {
            // Question - How are we going to sent fee to PrimeDao from the internalBalance?

            // calculate the primeDaoFeeAmount from the amount of project tokens and the primeDaoFeePercentage
            uint256 feeConvertedForCalculation = HUNDRED_PERCENT +
                primeDaoFeePercentage;
            uint256 projectTokenAmount = (_amounts[0] /
                feeConvertedForCalculation) * HUNDRED_PERCENT;
            uint256 primeDaoFeeAmount = _amounts[0] - projectTokenAmount;

            // adjust project token amount to before fee got added
            _amounts[0] = projectTokenAmount;

            // ToDo - Line below does not work, this also needs to be tested
            // _tokens[0].transfer(primeDaoAddress, primeDaoFeeAmount);
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
     * @dev                             gets the swapFeePercentage from the pool
     */
    function getSwapFeePercentage() public view returns (uint256) {
        return lbp.getSwapFeePercentage();
    }
}
