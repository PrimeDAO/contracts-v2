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

/**
 * @title LBPManager contract.
 * @dev   Smart contract for managing interactions with a Balancer LBP.
 */
contract LBPManager {
    // Constants
    uint256 private constant HUNDRED_PERCENT = 10e18; // Used in calculating the PrimeDao fee.

    // Locked parameter
    address public admin; // The address of the admin of this contract.
    address public beneficiary; // The address that recieves fees.
    uint256 public primeDaoFeePercentage; // Fee expressed as a % (e.g. 10**18 = 100% fee, toWei('1') = 100%)
    ILBP public lbp; // The address of LBP that is managed by this contract.
    IERC20[] public tokenList; // The tokens that are used in the LBP.
    uint256[] public amounts; // The amount of tokens that are going to be added as liquidity in LBP.

    // Contract logic
    bool public poolFunded; // true:- LBP is funded; false:- LBP is yet not funded.
    bool public initialized; // true:- LBP created; false:- LBP not yet created. Makes sure, only initialized once.

    modifier onlyAdmin() {
        require(msg.sender == admin, "LBPManager: caller should be admin");
        _;
    }

    /**
     * @dev                             Transfer admin rights.
     * @param _newAdmin                 Address of the new admin.
     */
    function transferAdminRights(address _newAdmin) external onlyAdmin {
        require(
            _newAdmin != address(0),
            "LBPManager: new admin can not be zero"
        );
        admin = _newAdmin;
    }

    /**
     * @dev                             Initialize LBPManager.
     * @param _LBPFactory               LBP factory address.
     * @param _beneficiary              The address that receives the _primeDaoFeePercentage.
     * @param _name                     Name of the LBP.
     * @param _symbol                   Symbol of the LBP.
     * @param _tokenList                Numerically sorted array (ascending) containing two addresses:
                                            - The address of the project token being distributed.
                                            - The address of the funding token being exchanged for the project token.
     * @param _amounts                  Sorted array to match the _tokenList, containing two parameters:
                                            - The amounts of project token to be added as liquidity to the LBP.
                                            - The amounts of funding token to be added as liquidity to the LBP.
     * @param _weights                  Sorted array to match the _tokenList, containing two parametes:
                                            - The start weight for the project token in the LBP.
                                            - The start weight for the funding token in the LBP.
     * @param _startTimeEndTime         Array containing two parameters:
                                            - Start time for the LBP.
                                            - End time for the LBP.
     * @param _endWeights               Sorted array to match the _tokenList, containing two parametes:
                                            - The end weight for the project token in the LBP.
                                            - The end weight for the funding token in the LBP.
     * @param _swapFeePercentage        Percentage of fee paid for every swap in the LBP.
     * @param _primeDaoFeePercentage    Percentage of fee paid to PrimeDao for providing the service of the LBP Manager.
     */
    function initializeLBP(
        address _LBPFactory,
        address _beneficiary,
        string memory _name,
        string memory _symbol,
        IERC20[] memory _tokenList,
        uint256[] memory _amounts,
        uint256[] memory _weights,
        uint256[] memory _startTimeEndTime,
        uint256[] memory _endWeights,
        uint256 _swapFeePercentage,
        uint256 _primeDaoFeePercentage
    ) external returns (address) {
        require(!initialized, "LBPManager: already initialized");
        require(
            _beneficiary != address(0),
            "LBPManager: _beneficiary can not be zero address"
        );
        require(_tokenList.length == 2, "LBPManager: token list size is not 2");

        initialized = true;
        admin = msg.sender;
        primeDaoFeePercentage = _primeDaoFeePercentage;
        beneficiary = _beneficiary;
        amounts = _amounts;
        tokenList = _tokenList;

        lbp = ILBP(
            ILBPFactory(_LBPFactory).create(
                _name,
                _symbol,
                _tokenList,
                _weights,
                _swapFeePercentage,
                address(this),
                true // SwapEnabled is set to true at pool creation.
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
     * @dev                             Subtracts the primeDaoFee and adds liquidity to the LBP.
     * @param _projectTokenIndex        Index for the _tokenList array for the funding token.
     * @param _sender                   Address of the liquidity provider.
     * @param _userData                 UserData object that specifies the type of join.
     */
    function addLiquidity(
        uint8 _projectTokenIndex,
        address _sender,
        bytes memory _userData
    ) external onlyAdmin {
        require(!poolFunded, "LBPManager: pool has already been funded");
        poolFunded = true;

        IVault vault = lbp.getVault();

        if (primeDaoFeePercentage != 0) {
            // Transfer primeDaoFee to beneficiary.
            tokenList[_projectTokenIndex].transferFrom(
                _sender,
                beneficiary,
                _feeAmountRequired(_projectTokenIndex)
            );
        }

        for (uint8 i; i < tokenList.length; i++) {
            tokenList[i].transferFrom(_sender, address(this), amounts[i]);
            tokenList[i].approve(address(vault), amounts[i]);
        }

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
            maxAmountsIn: amounts,
            userData: _userData,
            fromInternalBalance: false, // It is not possible to add liquidity through the internal Vault balance.
            assets: tokenList
        });

        vault.joinPool(lbp.getPoolId(), address(this), address(this), request);
    }

    /**
     * @dev                             exit pool or remove liquidity from pool
     * @param _receiver                 Address of the liquidity receiver, after exiting the LBP.
     * @param _toInternalBalance        Balancer's Vault option to send the liquidity from the LBP to the _receivers internal Vault balance.
     * @param _userData                 UserData object that specifies the type of exit.
     */
    function removeLiquidity(
        address payable _receiver,
        bool _toInternalBalance,
        bytes memory _userData
    ) external onlyAdmin {
        require(
            _receiver != payable(address(0)),
            "LBPManager: receiver of project and funding tokens can't be zero"
        );
        require(
            lbp.balanceOf(address(this)) > 0,
            "LBPManager: manager does not have any pool tokens to remove liquidity"
        );

        uint256 endTime;
        (, endTime, ) = lbp.getGradualWeightUpdateParams();

        require(
            block.timestamp >= endTime,
            "LBPManager: can not remove liqudity from the pool before endtime"
        );

        // To remove all funding from the pool. Initializes to [0, 0]
        uint256[] memory _minAmountsOut = new uint256[](tokenList.length);

        IVault vault = lbp.getVault();

        IVault.ExitPoolRequest memory request = IVault.ExitPoolRequest({
            minAmountsOut: _minAmountsOut,
            userData: _userData,
            toInternalBalance: _toInternalBalance,
            assets: tokenList
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
        directly from Balancer's LBP. LBPManager or PrimeDAO will no longer provide support to do so.
    */
    /**
     * @dev                             Withdraw pool tokens if available.
     * @param _receiver                 Address of the BPT tokens receiver.
     */
    function withdrawPoolTokens(address _receiver) external onlyAdmin {
        require(
            _receiver != address(0),
            "LBPManager: receiver of pool tokens can't be zero"
        );

        uint256 endTime;
        (, endTime, ) = lbp.getGradualWeightUpdateParams();
        require(
            block.timestamp >= endTime,
            "LBPManager: can not withdraw pool tokens before endtime"
        );

        require(
            lbp.balanceOf(address(this)) > 0,
            "LBPManager: manager does not have any pool tokens to withdraw"
        );

        lbp.transfer(_receiver, lbp.balanceOf(address(this)));
    }

    /**
     * @dev                             Can pause/unpause trading.
     * @param _swapEnabled              Enables/disables swapping.
     */
    function setSwapEnabled(bool _swapEnabled) external onlyAdmin {
        lbp.setSwapEnabled(_swapEnabled);
    }

    /**
     * @dev     Get required amount of project tokens to cover for fees and the actual LBP.
     */
    function projectTokensRequired(uint8 _projectTokenIndex)
        external
        view
        returns (uint256 projectTokenAmounts)
    {
        projectTokenAmounts =
            amounts[_projectTokenIndex] +
            _feeAmountRequired(_projectTokenIndex);
    }

    /**
     * @dev     Get required amount of project tokens to cover for fees.
     */
    function _feeAmountRequired(uint8 _projectTokenIndex)
        internal
        view
        returns (uint256 feeAmount)
    {
        feeAmount =
            (amounts[_projectTokenIndex] * primeDaoFeePercentage) /
            HUNDRED_PERCENT;
    }
}
