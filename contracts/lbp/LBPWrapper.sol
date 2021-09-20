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
    // constants
    uint256 private constant HUNDRED_PERCENT = 10e18;

    // locked parameter
    address public admin; // The address of the admin of this contract.
    address public beneficiary; // The address that recieves fees
    uint256 public primeDaoFeePercentage; // fee expressed as a % (e.g. 10**18 = 100% fee, toWei('1') = 100%)
    ILBP public lbp; // address of LBP that is managed by this contract.
    IERC20[] public tokens; // tokens that are used in the LBP
    uint256[] public amounts; // amount of tokens that are going to be added as liquidity in LBP

    bool public poolFunded; // true:- LBP is funded; false:- LBP is yet not funded.
    bool public initialized; // true:- LBP created; false:- LBP not yet created. Makes sure, only initialized once.

    modifier onlyAdmin() {
        require(msg.sender == admin, "LBPWrapper: only admin function");
        _;
    }

    /**
     * @dev                             transfer admin rights to new admin
     * @param _newAdmin                 new admin address
     */
    function transferAdminRights(address _newAdmin) external onlyAdmin {
        require(
            _newAdmin != address(0),
            "LBPWrapper: new admin can not be zero"
        );
        admin = _newAdmin;
    }

    /**
     * @dev                             initialize lbp wrapper contract
     * @param _LBPFactory               LBP factory address
     * @param _beneficiary              address of the receiver of the _primeDaoFeePercentage
     * @param _name                     LBP name
     * @param _symbol                   LBP symbol
     * @param _tokens                   array of tokens sorted for the LBP
     * @param _weights                  array of amounts of tokens that would be added as liquidity.
     * @param _weights                  array of start weights for respective tokens
     * @param _startTimeEndTime         array of start time and end time
     * @param _endWeights               array of end weights for respective tokens
     * @param _swapFeePercentage        fee percentage for swapping
     * @param _primeDaoFeePercentage    fee percentage for providing the LBP service
     */
    function initializeLBP(
        address _LBPFactory,
        address _beneficiary,
        string memory _name,
        string memory _symbol,
        IERC20[] memory _tokens,
        uint256[] memory _amounts,
        uint256[] memory _weights,
        uint256[] memory _startTimeEndTime,
        uint256[] memory _endWeights,
        uint256 _swapFeePercentage,
        uint256 _primeDaoFeePercentage
    ) external returns (address) {
        require(!initialized, "LBPWrapper: already initialized");
        require(
            _beneficiary != address(0),
            "LBPWrapper: _beneficiary can not be zero address"
        );

        initialized = true;
        admin = msg.sender;
        primeDaoFeePercentage = _primeDaoFeePercentage;
        beneficiary = _beneficiary;
        amounts = _amounts;
        tokens = _tokens;

        lbp = ILBP(
            ILBPFactory(_LBPFactory).create(
                _name,
                _symbol,
                _tokens,
                _weights,
                _swapFeePercentage,
                address(this),
                true // swapEnabled is set to true at pool creation
            )
        );

        lbp.updateWeightsGradually(
            _startTimeEndTime[0],
            _startTimeEndTime[1],
            _endWeights
        );

        return address(lbp);
    }

    /**
     * @dev                             approve tokens for the vault and join pool to provide liquidity
     * @param _tokens                   array of tokens sorted for the LBP
     * @param _sender                   address who will send the tokens to add liquidity
     * @param _fromInternalBalance      fund tokens from the internal user balance
     * @param _userData                 userData specifies the type of join
     */
    function fundPool(
        IERC20[] memory _tokens,
        address _sender,
        bool _fromInternalBalance,
        bytes memory _userData
    ) public onlyAdmin {
        require(!poolFunded, "LBPWrapper: pool has already been funded");
        poolFunded = true;

        IVault vault = lbp.getVault();

        if (primeDaoFeePercentage != 0) {
            // transfer primeDaoFee to beneficiary
            _tokens[0].transferFrom(_sender, beneficiary, feeAmountRequired());
        }

        for (uint8 i; i < _tokens.length; i++) {
            _tokens[i].transferFrom(_sender, address(this), amounts[i]);
            _tokens[i].approve(address(vault), amounts[i]);
        }

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
            maxAmountsIn: amounts,
            userData: _userData,
            fromInternalBalance: _fromInternalBalance,
            assets: _tokens
        });

        vault.joinPool(lbp.getPoolId(), address(this), address(this), request);
    }

    /**
     * @dev exit pool or remove liquidity from pool
     * @param _tokens                   array of tokens sorted for the LBP
     * @param _receiver                 address who will be credited with the tokens after removing liquidity
     * @param _toInternalBalance        fund tokens to the internal user balance
     * @param _userData                 userData specifies the type of exit
     */
    function removeLiquidity(
        IERC20[] memory _tokens,
        address payable _receiver,
        bool _toInternalBalance,
        bytes memory _userData
    ) external {
        require(
            _receiver != payable(address(0)),
            "LBPWrapper: receiver of project and funding tokens can't be zero"
        );
        require(
            lbp.balanceOf(address(this)) > 0,
            "LBPWrapper: wrapper does not have any pool tokens to remove liquidity"
        );

        uint256 endTime;
        (, endTime, ) = lbp.getGradualWeightUpdateParams();

        require(
            block.timestamp >= endTime,
            "LBPWrapper: can not remove liqudity from the pool before endtime"
        );

        // to remove all funding from the pool. Initializes to [0, 0]
        uint256[] memory _minAmountsOut = new uint256[](2);

        IVault vault = lbp.getVault();

        IVault.ExitPoolRequest memory request = IVault.ExitPoolRequest({
            minAmountsOut: _minAmountsOut,
            userData: _userData,
            toInternalBalance: _toInternalBalance,
            assets: _tokens
        });

        lbp.approve(address(vault), lbp.balanceOf(address(this)));

        vault.exitPool(lbp.getPoolId(), address(this), _receiver, request);
    }

    /*
        DISCLAIMER:
        The method below is an advanced functionality. By invoking this method, you are withdrawing
        the BPT tokens, which are necessary to exit the pool. If you chose to remove the BPT tokens,
        the LBPManager will no longer be able to remove liquidity. By withdrawing the BPT tokens
        you agree on removing all the responsibility from the LBPManger for removing liquidity from
        the pool and transferring this responsibility to the holder of the BPT tokens. Any possible
        loss of funds by choosing to withdraw the BPT tokens is not the responsibility of
        LBPManager or PrimeDao. After withdrawing the BPT tokens, liquidity has to be withdrawn
        directly from Balancer's LBP. LBPWrapper or PrimeDAO will no longer provide support to do so.
    */
    /**
     * @dev                             will withdraw pool tokens if available
     * @param _receiver                 address that receives the pool tokens
     */
    function withdrawPoolTokens(address _receiver) external onlyAdmin {
        require(
            _receiver != address(0),
            "LBPWrapper: receiver of pool tokens can't be zero"
        );

        uint256 endTime;
        (, endTime, ) = lbp.getGradualWeightUpdateParams();
        require(
            block.timestamp >= endTime,
            "LBPWrapper: can not withdraw pool tokens before endtime"
        );

        require(
            lbp.balanceOf(address(this)) > 0,
            "LBPWrapper: wrapper does not have any pool tokens to withdraw"
        );

        lbp.transfer(_receiver, lbp.balanceOf(address(this)));
    }

    /**
     * @dev                             can pause/unpause trading
     * @param _swapEnabled              enable/disable swapping
     */
    function setSwapEnabled(bool _swapEnabled) public onlyAdmin {
        lbp.setSwapEnabled(_swapEnabled);
    }

    /**
     * @dev     get required amount of tokens
     */
    function projectTokensRequired()
        public
        view
        returns (uint256 projectTokenAmounts)
    {
        projectTokenAmounts =
            amounts[0] +
            ((amounts[0] * primeDaoFeePercentage) / HUNDRED_PERCENT);
    }

    /**
     * @dev     get required amount of tokens
     */
    function feeAmountRequired() internal view returns (uint256 feeAmount) {
        feeAmount = (amounts[0] * primeDaoFeePercentage) / HUNDRED_PERCENT;
    }
}
