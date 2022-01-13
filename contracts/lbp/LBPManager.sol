/*
██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░
*/

// SPDX-License-Identifier: GPL-3.0-or-later
// LBPManager contract. Smart contract for managing interactions with a Balancer LBP.
// Copyright (C) 2021 PrimeDao

// solium-disable linebreak-style
pragma solidity 0.8.9;

import "openzeppelin-contracts-sol8/token/ERC20/IERC20.sol";
import "../utils/interface/ILBPFactory.sol";
import "../utils/interface/IVault.sol";
import "../utils/interface/ILBP.sol";

/**
 * @title LBPManager contract.
 * @dev   Smart contract for managing interactions with a Balancer LBP.
 */
// solhint-disable-next-line max-states-count
contract LBPManager {
    // Constants
    uint256 private constant HUNDRED_PERCENT = 1e18; // Used in calculating the fee.

    // Locked parameter
    string public symbol; // Symbol of the LBP.
    string public name; // Name of the LBP.
    address public admin; // Address of the admin of this contract.
    address public beneficiary; // Address that recieves fees.
    uint256 public feePercentage; // Fee expressed as a % (e.g. 10**18 = 100% fee, toWei('1') = 100%, 1e18)
    uint256 public swapFeePercentage; // Percentage of fee paid for every swap in the LBP.
    IERC20[] public tokenList; // Tokens that are used in the LBP, sorted by address in numerical order (ascending).
    uint256[] public amounts; // Amount of tokens to be added as liquidity in LBP.
    uint256[] public startWeights; // Array containing the startWeights for the project & funding token.
    uint256[] public endWeights; // Array containing the endWeights for the project & funding token.
    uint256[] public startTimeEndTime; // Array containing the startTime and endTime for the LBP.
    ILBP public lbp; // Address of LBP that is managed by this contract.
    bytes public metadata; // IPFS Hash of the LBP creation wizard information.
    uint8 public projectTokenIndex; // Index repesenting the project token in the tokenList.
    address public lbpFactory; // Address of Balancers LBP factory.

    // Contract logic
    bool public poolFunded; // true:- LBP is funded; false:- LBP is not funded.
    bool public initialized; // true:- LBPManager initialized; false:- LBPManager not initialized. Makes sure, only initialized once.

    event LBPManagerAdminChanged(
        address indexed oldAdmin,
        address indexed newAdmin
    );
    event FeeTransferred(
        address indexed beneficiary,
        address tokenAddress,
        uint256 amount
    );
    event PoolTokensWithdrawn(address indexed lbpAddress, uint256 amount);
    event MetadataUpdated(bytes indexed metadata);

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
     * @param _lbpFactory               LBP factory address.
     * @param _beneficiary              The address that receives the feePercentage.
     * @param _name                     Name of the LBP.
     * @param _symbol                   Symbol of the LBP.
     * @param _tokenList                Array containing two addresses in order of:
                                            1. The address of the project token being distributed.
                                            2. The address of the funding token being exchanged for the project token.
     * @param _amounts                  Array containing two parameters in order of:
                                            1. The amounts of project token to be added as liquidity to the LBP.
                                            2. The amounts of funding token to be added as liquidity to the LBP.
     * @param _startWeights             Array containing two parametes in order of:
                                            1. The start weight for the project token in the LBP.
                                            2. The start weight for the funding token in the LBP.
     * @param _startTimeEndTime         Array containing two parameters in order of:
                                            1. Start time for the LBP.
                                            2. End time for the LBP.
     * @param _endWeights               Array containing two parametes in order of:
                                            1. The end weight for the project token in the LBP.
                                            2. The end weight for the funding token in the LBP.
    * @param _fees                      Array containing two parameters in order of:
                                            1. Percentage of fee paid for every swap in the LBP.
                                            2. Percentage of fee paid to the _beneficiary for providing the service of the LBP Manager.
     * @param _metadata                 IPFS Hash of the LBP creation wizard information.
     */
    function initializeLBPManager(
        address _lbpFactory,
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
    ) external {
        require(!initialized, "LBPManager: already initialized");
        require(_beneficiary != address(0), "LBPManager: _beneficiary is zero");
        // solhint-disable-next-line reason-string
        require(_fees[0] >= 1e12, "LBPManager: swapFeePercentage to low"); // 0.0001%
        // solhint-disable-next-line reason-string
        require(_fees[0] <= 1e17, "LBPManager: swapFeePercentage to high"); // 10%
        require(
            _tokenList.length == 2 &&
                _amounts.length == 2 &&
                _startWeights.length == 2 &&
                _startTimeEndTime.length == 2 &&
                _endWeights.length == 2 &&
                _fees.length == 2,
            "LBPManager: arrays wrong size"
        );
        require(
            _tokenList[0] != _tokenList[1],
            "LBPManager: tokens can't be same"
        );
        require(
            _startTimeEndTime[0] < _startTimeEndTime[1],
            "LBPManager: startTime > endTime"
        );

        initialized = true;
        admin = msg.sender;
        swapFeePercentage = _fees[0];
        feePercentage = _fees[1];
        beneficiary = _beneficiary;
        metadata = _metadata;
        startTimeEndTime = _startTimeEndTime;
        name = _name;
        symbol = _symbol;
        lbpFactory = _lbpFactory;

        // Token addresses are sorted in numerical order (ascending) as specified by Balancer
        if (address(_tokenList[0]) > address(_tokenList[1])) {
            projectTokenIndex = 1;
            tokenList.push(_tokenList[1]);
            tokenList.push(_tokenList[0]);

            amounts.push(_amounts[1]);
            amounts.push(_amounts[0]);

            startWeights.push(_startWeights[1]);
            startWeights.push(_startWeights[0]);

            endWeights.push(_endWeights[1]);
            endWeights.push(_endWeights[0]);
        } else {
            projectTokenIndex = 0;
            tokenList = _tokenList;
            amounts = _amounts;
            startWeights = _startWeights;
            endWeights = _endWeights;
        }
    }

    /**
     * @dev                             Subtracts the fee, deploys the LBP and adds liquidity to it.
     * @param _sender                   Address of the liquidity provider.
     */
    function initializeLBP(address _sender) external onlyAdmin {
        // solhint-disable-next-line reason-string
        require(initialized == true, "LBPManager: LBPManager not initialized");
        require(!poolFunded, "LBPManager: pool already funded");
        poolFunded = true;

        lbp = ILBP(
            ILBPFactory(lbpFactory).create(
                name,
                symbol,
                tokenList,
                startWeights,
                swapFeePercentage,
                address(this),
                false // SwapEnabled is set to false at pool creation.
            )
        );

        lbp.updateWeightsGradually(
            startTimeEndTime[0],
            startTimeEndTime[1],
            endWeights
        );

        IVault vault = lbp.getVault();

        if (feePercentage != 0) {
            // Transfer fee to beneficiary.
            uint256 feeAmountRequired = _feeAmountRequired();
            tokenList[projectTokenIndex].transferFrom(
                _sender,
                beneficiary,
                feeAmountRequired
            );
            emit FeeTransferred(
                beneficiary,
                address(tokenList[projectTokenIndex]),
                feeAmountRequired
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
     * @dev                             Exit pool or remove liquidity from pool.
     * @param _receiver                 Address of the liquidity receiver, after exiting the LBP.
     */
    function removeLiquidity(address _receiver) external onlyAdmin {
        require(_receiver != address(0), "LBPManager: receiver is zero");
        require(
            lbp.balanceOf(address(this)) > 0,
            "LBPManager: no BPT token balance"
        );

        uint256 endTime = startTimeEndTime[1];
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp >= endTime, "LBPManager: endtime not reached");

        IVault vault = lbp.getVault();

        IVault.ExitPoolRequest memory request = IVault.ExitPoolRequest({
            minAmountsOut: new uint256[](tokenList.length), // To remove all funding from the pool. Initializes to [0, 0]
            userData: abi.encode(1, lbp.balanceOf(address(this))),
            toInternalBalance: false,
            assets: tokenList
        });

        vault.exitPool(
            lbp.getPoolId(),
            address(this),
            payable(_receiver),
            request
        );
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

        uint256 endTime = startTimeEndTime[1];
        // solhint-disable-next-line not-rely-on-time
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
     * @dev                              Tells whether swaps are enabled or not for the LBP
     */
    function getSwapEnabled() external view returns (bool) {
        require(poolFunded, "LBPManager: LBP not initialized.");
        return lbp.getSwapEnabled();
    }

    /**
     * @dev             Get required amount of project tokens to cover for fees and the actual LBP.
     */
    function projectTokensRequired()
        external
        view
        returns (uint256 projectTokenAmounts)
    {
        projectTokenAmounts = amounts[projectTokenIndex] + _feeAmountRequired();
    }

    /**
     * @dev                             Updates metadata.
     * @param _metadata                 LBP wizard contract metadata, that is an IPFS Hash.
     */
    function updateMetadata(bytes memory _metadata) external onlyAdmin {
        metadata = _metadata;
        emit MetadataUpdated(_metadata);
    }

    /**
     * @dev             Get required amount of project tokens to cover for fees.
     */
    function _feeAmountRequired() internal view returns (uint256 feeAmount) {
        feeAmount =
            (amounts[projectTokenIndex] * feePercentage) /
            HUNDRED_PERCENT;
    }
}
