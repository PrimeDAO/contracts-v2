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
import "hardhat/console.sol";

/**
 * @title LBPManager contract.
 * @dev   Smart contract for managing interactions with a Balancer LBP.
 */
contract LBPManager {
    // Constants
    uint256 private constant HUNDRED_PERCENT = 10e18; // Used in calculating the fee.

    // Locked parameter
    address public admin; // The address of the admin of this contract.
    address public beneficiary; // The address that recieves fees.
    uint256 public feePercentage; // Fee expressed as a % (e.g. 10**18 = 100% fee, toWei('1') = 100%)
    uint8 private projectTokenIndex; // The address of the project token.
    uint256[] public amounts; // The amount of tokens that are going to be added as liquidity in LBP.
    bytes public metadata; // IPFS Hash of the LBP creation wizard information.
    ILBP public lbp; // The address of LBP that is managed by this contract.
    IERC20[] public tokenList; // The tokens that are used in the LBP.

    // Contract logic
    bool public poolFunded; // true:- LBP is funded; false:- LBP is yet not funded.
    bool public initialized; // true:- LBP created; false:- LBP not yet created. Makes sure, only initialized once.

    event LBPManagerAdminChanged(
        address indexed oldAdmin,
        address indexed newAdmin
    );

    event FeeTransferred(
        address indexed beneficiary,
        address tokenAddress,
        uint256 amount
    );

    event PoolTokensWithdrawn(address indexed LbpAddress, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "LBPManager: caller is not admin");
        _;
    }

    /**
     * @dev                             Transfer admin rights.
     * @param _newAdmin                 Address of the new admin.
     */
    function transferAdminRights(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "LBPManager: new admin is zero");

        emit LBPManagerAdminChanged(admin, _newAdmin);
        admin = _newAdmin;
    }

    /**
     * @dev                             Initialize LBPManager.
     * @param _LBPFactory               LBP factory address.
     * @param _beneficiary              The address that receives the feePercentage.
     * @param _name                     Name of the LBP.
     * @param _symbol                   Symbol of the LBP.
     * @param _tokenList                array containing two addresses in order:
                                            - The address of the project token being distributed.
                                            - The address of the funding token being exchanged for the project token.
     * @param _amounts                  array containing two parameters in order:
                                            - The amounts of project token to be added as liquidity to the LBP.
                                            - The amounts of funding token to be added as liquidity to the LBP.
     * @param _startWeights             array containing two parametes in order:
                                            - The start weight for the project token in the LBP.
                                            - The start weight for the funding token in the LBP.
     * @param _startTimeEndTime         array containing two parameters in order:
                                            - Start time for the LBP.
                                            - End time for the LBP.
     * @param _endWeights               array containing two parametes in order:
                                            - The end weight for the project token in the LBP.
                                            - The end weight for the funding token in the LBP.
    * @param _fees                      array containing two parameters in order:
                                            - Percentage of fee paid for every swap in the LBP.
                                            - Percentage of fee paid to the _beneficiary for providing the service of the LBP Manager.
     * @param _metadata                 IPFS Hash of the LBP creation wizard information.
     */
    function initializeLBP(
        address _LBPFactory,
        address _beneficiary,
        string memory _name,
        string memory _symbol,
        IERC20[] memory _tokenList,
        uint256[] memory _amounts,
        uint256[] memory _startWeights,
        uint256[] memory _startTimeEndTime,
        uint256[] memory _endWeights,
        uint256[] memory _fees,
        bytes memory _metadata
    ) external returns (address) {
        require(!initialized, "LBPManager: already initialized");
        require(_beneficiary != address(0), "LBPManager: _beneficiary is zero");

        initialized = true;
        admin = msg.sender;
        feePercentage = _fees[1];
        beneficiary = _beneficiary;
        metadata = _metadata;

        if (address(_tokenList[0]) > address(_tokenList[1])) {
            tokenList.push(_tokenList[1]);
            tokenList.push(_tokenList[0]);
            amounts.push(_amounts[1]);
            amounts.push(_amounts[0]);

            projectTokenIndex = 1;
            uint256 swap = _startWeights[0];
            _startWeights[0] = _startWeights[1];
            _startWeights[1] = swap;

            swap = _endWeights[0];
            _endWeights[0] = _endWeights[1];
            _endWeights[1] = swap;
        } else {
            projectTokenIndex = 0;
            tokenList = _tokenList;
            amounts = _amounts;
        }

        lbp = ILBP(
            ILBPFactory(_LBPFactory).create(
                _name,
                _symbol,
                _tokenList,
                _startWeights,
                _fees[0], // swapFeePercentage
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

    // function sortArray()

    /**
     * @dev                             Subtracts the fee and adds liquidity to the LBP.
     * @param _sender                   Address of the liquidity provider.
     */
    function addLiquidity(address _sender) external onlyAdmin {
        require(!poolFunded, "LBPManager: pool already funded");
        poolFunded = true;

        IVault vault = lbp.getVault();

        if (feePercentage != 0) {
            // Transfer fee to beneficiary.
            tokenList[projectTokenIndex].transferFrom(
                _sender,
                beneficiary,
                _feeAmountRequired()
            );
            emit FeeTransferred(
                beneficiary,
                address(tokenList[projectTokenIndex]),
                _feeAmountRequired()
            );
        }

        for (uint8 i; i < tokenList.length; i++) {
            tokenList[i].transferFrom(_sender, address(this), amounts[i]);
            tokenList[i].approve(address(vault), amounts[i]);
        }

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
            maxAmountsIn: amounts,
            userData: abi.encode(0, amounts), // JOIN_KIND_INIT = 0, used when adding liquidity for the first time.
            fromInternalBalance: false, // It is not possible to add liquidity through the internal Vault balance.
            assets: tokenList
        });

        vault.joinPool(lbp.getPoolId(), address(this), address(this), request);
    }

    /**
     * @dev                             exit pool or remove liquidity from pool
     * @param _receiver                 Address of the liquidity receiver, after exiting the LBP.
     */
    function removeLiquidity(address payable _receiver) external onlyAdmin {
        require(
            _receiver != payable(address(0)),
            "LBPManager: receiver is zero"
        );
        require(
            lbp.balanceOf(address(this)) > 0,
            "LBPManager: no BPT token balance"
        );

        uint256 endTime;
        (, endTime, ) = lbp.getGradualWeightUpdateParams();

        require(block.timestamp >= endTime, "LBPManager: endtime not reached");

        IVault vault = lbp.getVault();

        IVault.ExitPoolRequest memory request = IVault.ExitPoolRequest({
            minAmountsOut: new uint256[](tokenList.length), // To remove all funding from the pool. Initializes to [0, 0]
            userData: abi.encode(1, lbp.balanceOf(address(this))),
            toInternalBalance: false,
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
        require(_receiver != address(0), "LBPManager: receiver is zero");

        uint256 endTime;
        (, endTime, ) = lbp.getGradualWeightUpdateParams();
        require(block.timestamp >= endTime, "LBPManager: endtime not reached");

        require(
            lbp.balanceOf(address(this)) > 0,
            "LBPManager: no BPT token balance"
        );

        emit PoolTokensWithdrawn(address(lbp), lbp.balanceOf(address(this)));
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
    function projectTokensRequired()
        external
        view
        returns (uint256 projectTokenAmounts)
    {
        projectTokenAmounts = amounts[projectTokenIndex] + _feeAmountRequired();
    }

    /**
     * @dev     Get required amount of project tokens to cover for fees.
     */
    function _feeAmountRequired() internal view returns (uint256 feeAmount) {
        feeAmount =
            (amounts[projectTokenIndex] * feePercentage) /
            HUNDRED_PERCENT;
    }
}
