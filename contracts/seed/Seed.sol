/*

██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░

*/

// SPDX-License-Identifier: GPL-3.0-or-later
/* solhint-disable space-after-comma */
/* solhint-disable max-states-count */
// solium-disable linebreak-style
pragma solidity 0.8.4;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


/**
 * @title PrimeDAO Seed contract
 * @dev   Smart contract for seed phases of liquid launch.
 */
contract Seed {
    // Locked parameters
    address public beneficiary;
    address public admin;
    uint256 public softCap;
    uint256 public hardCap;
    uint256 public seedAmountRequired;    // Amount of seed required for distribution
    uint256 public feeAmountRequired;     // Amount of seed required for fee
    uint256 public price;
    uint256 public startTime;
    uint256 public endTime;               // set by project admin, this is the last resort endTime to be applied when
                                          //     maximumReached has not been reached by then
    bool    public permissionedSeed;
    uint32  public vestingDuration;
    uint32  public vestingCliff;
    IERC20  public seedToken;
    IERC20  public fundingToken;
    uint8   public fee;

    bytes   public metadata;           // IPFS Hash

    uint256 constant internal PCT_BASE        = 10 ** 18;  // // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // Contract logic
    bool    public closed;                 // is the distribution closed
    bool    public paused;                 // is the distribution paused
    bool    public isFunded;               // distribution can only start when required seed tokens have been funded
    bool    public initialized;            // is this contract initialized [not necessary that it is funded]
    bool    public minimumReached;         // if the softCap[minimum limit of funding token] is reached
    bool    public maximumReached;         // if the hardCap[maximum limit of funding token] is reached
    uint256 public vestingStartTime;       // timestamp for when vesting starts, by default == endTime,
                                           //     otherwise when maximumReached is reached
    uint256 public totalFunderCount;       // Total funders that have contributed.
    uint256 public seedRemainder;          // Amount of seed tokens remaining to be distributed
    uint256 public seedClaimed;            // Amount of seed token claimed by the user.
    uint256 public feeRemainder;           // Amount of seed tokens remaining for the fee
    uint256 public feeClaimed;             // Amount of seed tokens claimed as fee
    uint256 public fundingCollected;       // Amount of funding tokens collected by the seed contract.
    uint256 public fundingWithdrawn;       // Amount of funding token withdrawn from the seed contract.

    mapping (address => bool) public whitelisted;        // funders that are whitelisted and allowed to contribute
    mapping (address => FunderPortfolio) public funders; // funder address to funder portfolio

    event SeedsPurchased(address indexed recipient, uint256 amountPurchased);
    event TokensClaimed(address indexed recipient,uint256 amount,address indexed beneficiary,uint256 feeAmount);
    event FundingReclaimed(address indexed recipient, uint256 amountReclaimed);
    event MetadataUpdated(bytes indexed metadata);

    struct FunderPortfolio {
        uint256 seedAmount;                 // Total amount of seed tokens bought
        uint256 totalClaimed;               // Total amount of seed tokens claimed
        uint256 fundingAmount;              // Total amount of funding tokens contributed
        uint256 fee;                        // Total amount of fee in seed amount for this portfolio
        uint256 feeClaimed;                 // Total amount of fee sent to beneficiary for this portfolio
    }

    modifier initializer() {
        require(!initialized, "Seed: contract already initialized");
        initialized = true;
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Seed: caller should be admin");
        _;
    }

    modifier isActive() {
        require(!closed, "Seed: should not be closed");
        require(!paused, "Seed: should not be paused");
        _;
    }

    modifier allowedToBuy() {
        require(!maximumReached, "Seed: maximum funding reached");
        require(!permissionedSeed || whitelisted[msg.sender], "Seed: sender has no rights");
        require(endTime >= block.timestamp && startTime <= block.timestamp,
            "Seed: only allowed during distribution period");
        _;
    }

    modifier allowedToClaim() {
        require(minimumReached, "Seed: minimum funding amount not met");
        require(endTime <= block.timestamp || maximumReached,"Seed: the distribution has not yet finished");
        _;
    }

    modifier allowedToRetrieve() {
        require(!paused, "Seed: should not be paused");
        require(startTime <= block.timestamp, "Seed: distribution haven't started");
        require(!minimumReached, "Seed: minimum already met");
        _;
    }

    modifier allowedToWithdraw() {
        require(!paused, "Seed: should not be paused");
        require(minimumReached, "Seed: minimum funding amount not met");
        _;
    }

    /**
      * @dev                          Initialize Seed.
      * @param _beneficiary           The address that recieves fees.
      * @param _admin                 The address of the admin of this contract. Funds contract
                                      and has permissions to whitelist users, pause and close contract.
      * @param _tokens                Array containing two params:
                                        - The address of the seed token being distributed.
      *                                 - The address of the funding token being exchanged for seed token.
      * @param _softHardThresholds     Array containing two params:
                                        - the minimum funding token collection threshold in wei denomination.
                                        - the highest possible funding token amount to be raised in wei denomination.
      * @param _price                 The price in wei of fundingTokens when exchanged for seedTokens.
      * @param _startTime             Distribution start time in unix timecode.
      * @param _endTime               Distribution end time in unix timecode.
      * @param _vestingDuration       Vesting period duration in seconds.
      * @param _vestingCliff          Cliff duration in seconds.
      * @param _permissionedSeed      Set to true if only whitelisted adresses are allowed to participate.
      * @param _fee                   Success fee expressed as a % (e.g. 2 = 2% fee)
    */
    function initialize(
        address _beneficiary,
        address _admin,
        address[] memory _tokens,
        uint256[] memory _softHardThresholds,
        uint256 _price,
        uint256 _startTime,
        uint256 _endTime,
        uint32  _vestingDuration,
        uint32  _vestingCliff,
        bool    _permissionedSeed,
        uint8   _fee
    ) public initializer
    {

        // parameter check
        require(_tokens[0] != _tokens[1], "SeedFactory: seedToken cannot be fundingToken");
        require(_softHardThresholds[1] >= _softHardThresholds[0],"SeedFactory: hardCap cannot be less than softCap");
        require(_vestingDuration >= _vestingCliff, "SeedFactory: vestingDuration cannot be less than vestingCliff");
        require(_endTime > _startTime, "SeedFactory: endTime cannot be less than equal to startTime");

        beneficiary       = _beneficiary;
        admin             = _admin;
        softCap           = _softHardThresholds[0];
        hardCap           = _softHardThresholds[1];
        price             = _price;
        startTime         = _startTime;
        endTime           = _endTime;
        vestingStartTime  = endTime;
        vestingDuration   = _vestingDuration;
        vestingCliff      = _vestingCliff;
        permissionedSeed  = _permissionedSeed;
        seedToken         = IERC20(_tokens[0]);
        fundingToken      = IERC20(_tokens[1]);
        fee               = _fee;

        seedAmountRequired = (hardCap*PCT_BASE) / _price;
        feeAmountRequired  = (seedAmountRequired*_fee) / 100;
        seedRemainder      = seedAmountRequired;
        feeRemainder       = feeAmountRequired;
    }

    /**
      * @dev                     Buy seed tokens.
      * @param _fundingAmount    The amount of funding tokens to contribute.
    */
    function buy(uint256 _fundingAmount) public isActive allowedToBuy returns(uint256, uint256) {
        if (!isFunded) {
            require(seedToken.balanceOf(address(this)) >= seedAmountRequired + feeAmountRequired,
                "Seed: sufficient seeds not provided");
            isFunded = true;
        }
        // fundingAmount is an amount of fundingTokens required to buy _seedAmount of SeedTokens
        uint256 seedAmount = (_fundingAmount*PCT_BASE)/price;

        // Funding Token balance of this contract;
        uint256 fundingBalance = fundingCollected;

        // feeAmount is an amount of fee we are going to get in seedTokens
        uint256 feeAmount = (seedAmount*fee) / 100;

        // total fundingAmount should not be greater than the hardCap
        require( fundingBalance + _fundingAmount <= hardCap,
            "Seed: amount exceeds contract sale hardCap");

        require( seedRemainder >= seedAmount,
            "Seed: seed distribution would be exceeded");

        fundingCollected = fundingBalance + _fundingAmount;

        // the amount of seed tokens still to be distributed
        seedRemainder -= seedAmount;
        feeRemainder  -= feeAmount;

        // Here we are sending amount of tokens to pay for seed tokens to purchase
        require(fundingToken.transferFrom(msg.sender, address(this), _fundingAmount), "Seed: no tokens");

        if (fundingCollected >= softCap) {
            minimumReached = true;
        }
        if (fundingCollected >= hardCap) {
            maximumReached = true;
            vestingStartTime = _currentTime();
        }

        _addFunder(
            msg.sender,
            (funders[msg.sender].seedAmount + seedAmount),         // Previous Seed Amount + new seed amount
            (funders[msg.sender].fundingAmount + _fundingAmount),  // Previous Funding Amount + new funding amount
             funders[msg.sender].totalClaimed,
            (funders[msg.sender].fee + feeAmount),                  // Previous Fee + new fee
             funders[msg.sender].feeClaimed
            );

        // buyer, seed token purchased in this transaction (not the total amount of seed purchased)
        emit SeedsPurchased(msg.sender, seedAmount);

        return (seedAmount, feeAmount);
    }

    /**
      * @dev                     Claim vested seed tokens.
      * @param _funder           Address of funder to calculate seconds and amount claimable
      * @param _claimAmount      The amount of seed token a users wants to claim.
    */
    function claim(address _funder, uint256 _claimAmount) public allowedToClaim returns(uint256) {
        uint256 amountClaimable;

        amountClaimable = calculateClaim(_funder);
        require(amountClaimable > 0, "Seed: amount claimable is 0");
        require(amountClaimable >= _claimAmount, "Seed: request is greater than claimable amount");
        uint256 feeAmountOnClaim = (_claimAmount * fee) / 100;

        FunderPortfolio memory tokenFunder = funders[_funder];

        tokenFunder.totalClaimed    += _claimAmount;
        tokenFunder.feeClaimed      += feeAmountOnClaim;
        funders[_funder] = tokenFunder;

        seedClaimed += _claimAmount;
        feeClaimed  += feeAmountOnClaim;
        require(seedToken.transfer(beneficiary, feeAmountOnClaim), "Seed: cannot transfer to beneficiary");
        require(seedToken.transfer(_funder, _claimAmount), "Seed: no tokens");

        emit TokensClaimed(_funder, _claimAmount, beneficiary, feeAmountOnClaim);

        // fee on the distributed reward collected from admin
        return (feeAmountOnClaim);
    }

    /**
      * @dev         Returns funding tokens to user.
    */
    function retrieveFundingTokens() public allowedToRetrieve returns(uint256) {
        require(funders[msg.sender].fundingAmount > 0, "Seed: zero funding amount");
        FunderPortfolio memory tokenFunder = funders[msg.sender];
        uint256 fundingAmount = tokenFunder.fundingAmount;
        seedRemainder += tokenFunder.seedAmount;
        feeRemainder += tokenFunder.fee;
        tokenFunder.seedAmount    = 0;
        tokenFunder.fee           = 0;
        tokenFunder.fundingAmount = 0;
        funders[msg.sender]  = tokenFunder;
        fundingCollected -= fundingAmount;
        require(
            fundingToken.transfer(msg.sender, fundingAmount),
            "Seed: cannot return funding tokens to msg.sender"
        );
        emit FundingReclaimed(msg.sender, fundingAmount);

        return fundingAmount;
    }

    // ADMIN ACTIONS

    /**
      * @dev                     Pause distribution.
    */
    function pause() public onlyAdmin isActive {
        paused = true;
    }

    /**
      * @dev                     Unpause distribution.
    */
    function unpause() public onlyAdmin {
        require(closed != true, "Seed: should not be closed");
        require(paused == true, "Seed: should be paused");

        paused = false;
    }

    /**
      * @dev                     Close distribution.
    */
    function close() public onlyAdmin isActive {
        // transfer seed tokens back to admin
        if (minimumReached) {
            // remaining seeds = seedRemainder + feeRemainder
            uint256 seedToTransfer = seedRemainder+feeRemainder;
            require(
                seedToken.transfer(admin, seedToTransfer),
                "Seed: should transfer seed tokens to admin"
            );
            paused = false;
        } else {
            require(
                seedToken.transfer(admin, seedAmountRequired+feeAmountRequired),
                "Seed: should transfer seed tokens to admin"
            );
            closed = true;
            paused = false;
        }
    }

    /**
      * @dev                     Add address to whitelist.
      * @param _buyer            Address which needs to be whitelisted
    */
    function whitelist(address _buyer) public onlyAdmin isActive {
        require(permissionedSeed == true, "Seed: module is not whitelisted");

        whitelisted[_buyer] = true;
    }

    /**
      * @dev                     Add multiple addresses to whitelist.
      * @param _buyers           Array of addresses to whitelist addresses in batch
    */
    function whitelistBatch(address[] memory _buyers) public onlyAdmin isActive {
        require(permissionedSeed == true, "Seed: module is not whitelisted");
        for (uint256 i = 0; i < _buyers.length; i++) {
            whitelisted[_buyers[i]] = true;
        }
    }

    /**
      * @dev                     Remove address from whitelist.
      * @param buyer             Address which needs to be unwhitelisted
    */
    function unwhitelist(address buyer) public onlyAdmin isActive {
        require(permissionedSeed == true, "Seed: module is not whitelisted");

        whitelisted[buyer] = false;
    }

    /**
      * @dev                     Withdraw funds from the contract
    */
    function withdraw() public onlyAdmin allowedToWithdraw {
        uint pendingFundingBalance = fundingCollected - fundingWithdrawn;
        fundingWithdrawn = fundingCollected;
        fundingToken.transfer(msg.sender, pendingFundingBalance);
    }

    /**
      * @dev                     Updates metadata.
      * @param _metadata         Seed contract metadata, that is IPFS Hash
    */
    function updateMetadata(bytes memory _metadata) public {
        require(
            initialized != true || msg.sender == admin,
            "Seed: contract should not be initialized or caller should be admin"
        );
        metadata = _metadata;
        emit MetadataUpdated(_metadata);
    }

    // GETTER FUNCTIONS
    /**
      * @dev                     Calculates the maximum claim
      * @param _funder           Address of funder to find the maximum claim
    */
    function calculateClaim(address _funder) public view returns(uint256) {
        FunderPortfolio memory tokenFunder = funders[_funder];

        if (_currentTime() < vestingStartTime) {
            return 0;
        }

        // Check cliff was reached
        uint256 elapsedSeconds = _currentTime() - vestingStartTime;

        if (elapsedSeconds < vestingCliff) {
            return 0;
        }

        // If over vesting duration, all tokens vested
        if (elapsedSeconds >= vestingDuration) {
            return tokenFunder.seedAmount - tokenFunder.totalClaimed;
        } else {
            uint256 amountVested = (elapsedSeconds*tokenFunder.seedAmount) / vestingDuration;
            return amountVested - tokenFunder.totalClaimed;
        }
    }

    /**
      * @dev                     check whitelist status of a buyer
      * @param _buyer            address of buyer to check status
    */
    function checkWhitelisted(address _buyer) public view returns(bool) {
        return whitelisted[_buyer];
    }

    // INTERNAL FUNCTIONS
    /**
      * @dev                      get current time or block.timestamp
    */
    function _currentTime() internal view returns(uint256) {
        return block.timestamp;
    }

    /**
      * @dev                      add/update funder portfolio
      * @param _recipient         Address of funder recipient
      * @param _seedAmount        seed amount of the funder
      * @param _fundingAmount     funding amount contributed
      * @param _totalClaimed      total seed token amount claimed
      * @param _fee               fee on seed amount bought
    */
    function _addFunder(
        address _recipient,
        uint256 _seedAmount,
        uint256 _fundingAmount,
        uint256 _totalClaimed,
        uint256 _fee,
        uint256 _feeClaimed
    )
    internal
    {

        require(_seedAmount >= vestingDuration, "Seed: amountVestedPerSecond > 0");

        funders[_recipient] = FunderPortfolio({
            seedAmount: _seedAmount,
            totalClaimed: _totalClaimed,
            fundingAmount: _fundingAmount,
            fee: _fee,
            feeClaimed: _feeClaimed
            });
        totalFunderCount++;
    }
}
