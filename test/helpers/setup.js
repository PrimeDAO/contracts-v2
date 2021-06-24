const Seed = hre.artifacts.readArtifact('Seed');
const ERC20 = hre.artifacts.readArtifact("ERC20Mock")
// const ControllerCreator = artifacts.require('./ControllerCreator.sol');
// const DaoCreator = artifacts.require('./DaoCreator.sol');
// const DAOTracker = artifacts.require('./DAOTracker.sol');
// const GenericScheme = artifacts.require('GenericScheme');
// const GenericSchemeMultiCall = artifacts.require('GenericSchemeMultiCall')
// const Avatar = artifacts.require('./Avatar.sol');
// const DAOToken = artifacts.require('./DAOToken.sol');
// const Reputation = artifacts.require('./Reputation.sol');
// const AbsoluteVote = artifacts.require('./AbsoluteVote.sol');
// const LockingToken4Reputation = artifacts.require('./LockingToken4Reputation.sol');
// const PriceOracle = artifacts.require('./PriceOracle.sol');
// const FarmFactory = artifacts.require('./FarmFactory.sol');
// const SeedFactory = artifacts.require('./SeedFactory.sol');
// const Seed = artifacts.require('./Seed.sol');
// // Balancer imports
// const ConfigurableRightsPool = artifacts.require('ConfigurableRightsPool');
// const BPool = artifacts.require('BPool');
// const BFactory = artifacts.require('BFactory');
// const CRPFactory = artifacts.require('CRPFactory');
// const BalancerSafeMath = artifacts.require('BalancerSafeMath');
// const RightsManager = artifacts.require('RightsManager');
// const SmartPoolManager = artifacts.require('SmartPoolManager');
// const BalancerProxy = artifacts.require('BalancerProxy');
// const PrimeToken = artifacts.require('PrimeToken');
// const RepRedeemer = artifacts.require('RepRedeemer');


// const { time, constants } = require('@openzeppelin/test-helpers');
// // Incentives imports
// const StakingRewards = artifacts.require('StakingRewards');

// const MAX = web3.utils.toTwosComplement(-1);

// const { toWei } = web3.utils;
// const { fromWei } = web3.utils;

// const ARC_GAS_LIMIT = 6200000;
// const INITIAL_CASH_SUPPLY = '2000000000000000000000';
// const INITIAL_CASH_BALANCE = '100000000000000';
// const PDAO_TOKENS = toWei('1000');
// const PRIME_CAP = toWei('90000000');
// const PRIME_SUPPLY = toWei('21000000');
// const REPUTATION = '1000';

// const deployOrganization = async (daoCreator, daoCreatorOwner, founderToken, founderReputation, cap = 0) => {
//     var org = {};
//     var tx = await daoCreator.forgeOrg('primeDAO', 'PrimeDAO token', 'PDAO', daoCreatorOwner, founderToken, founderReputation, cap, { gas: constants.ARC_GAS_LIMIT });
//     assert.equal(tx.logs.length, 1);
//     assert.equal(tx.logs[0].event, 'NewOrg');
//     var avatarAddress = tx.logs[0].args._avatar;
//     org.avatar = await Avatar.at(avatarAddress);
//     var tokenAddress = await org.avatar.nativeToken();
//     org.token = await DAOToken.at(tokenAddress);
//     var reputationAddress = await org.avatar.nativeReputation();
//     org.reputation = await Reputation.at(reputationAddress);
//     return org;
// };

// const setAbsoluteVote = async (voteOnBehalf = constants.ZERO_ADDRESS, precReq = 50) => {
//     var votingMachine = {};
//     votingMachine.absoluteVote = await AbsoluteVote.new();
//     // register some parameters
//     await votingMachine.absoluteVote.setParameters(precReq, voteOnBehalf);
//     votingMachine.params = await votingMachine.absoluteVote.getParametersHash(precReq, voteOnBehalf);
//     return votingMachine;
// };

const initialize = async (root) => {
    const setup = {};
    setup.root = root;
    setup.data = {};
    setup.data.balances = [];
    return setup;
};

const tokens = async (setup) => {
	console.log(ERC20)
    const erc20s = [await ERC20.new('DAI Stablecoin', 'DAI', 18), await ERC20.new('USDC Stablecoin', 'USDC', 15), await ERC20.new('USDT Stablecoin', 'USDT', 18)];
    const primeToken = await PrimeToken.new(PRIME_SUPPLY, PRIME_CAP, setup.root);
    return { erc20s, primeToken};
};

// const incentives = async (setup) => {
//     const stakingRewards = await StakingRewards.new();

//     return { stakingRewards };
// };

// const repRedeemer = async (setup) => {
//     const repRedeemer = await RepRedeemer.new();

//     return repRedeemer;
// };

// const farmFactory = async (setup) => {
//     const farmFactory = await FarmFactory.new();
//     const stakingRewards = await StakingRewards.new();
//     let tx = await farmFactory.initialize(setup.organization.avatar.address, stakingRewards.address);

//     return farmFactory;
// };

// const seedFactory = async (setup) => {
//     const seedFactory = await SeedFactory.new();
//     return seedFactory;
// };

const seed = async () => {
    const seed = await Seed.new();

    return seed;
};

// const balancer = async (setup) => {
//     // deploy balancer infrastructure
//     const bfactory = await BFactory.new();

//     const balancerSafeMath = await BalancerSafeMath.new();
//     const rightsManager = await RightsManager.new();
//     const smartPoolManager = await SmartPoolManager.new();

//     await CRPFactory.link("BalancerSafeMath", balancerSafeMath.address);
//     await CRPFactory.link("RightsManager", rightsManager.address);
//     await CRPFactory.link("SmartPoolManager", smartPoolManager.address);

//     const crpFactory = await CRPFactory.new();

//     const usdc = await setup.tokens.erc20s[1];
//     const dai = await setup.tokens.erc20s[0];
//     const primetoken = await setup.tokens.primeToken;
//     const usdt = await setup.tokens.erc20s[2];

//     const USDC = await usdc.address;
//     const DAI = await dai.address;
//     const PRIMEToken = await primetoken.address;

//     const tokenAddresses = [PRIMEToken, DAI, USDC];

//     const swapFee = 10 ** 15;
//     const startWeights = [toWei('8'), toWei('1'), toWei('1')];
//     const startBalances = [toWei('10000'), toWei('5000'), toWei('5000')];
//     const SYMBOL = 'BPOOL';
//     const NAME = 'Prime Balancer Pool Token';

//     const permissions = {
//         canPauseSwapping: true,
//         canChangeSwapFee: true,
//         canChangeWeights: true,
//         canAddRemoveTokens: true,
//         canWhitelistLPs: false,
//     };

//     const poolParams = {
//         poolTokenSymbol: SYMBOL,
//         poolTokenName: NAME,
//         constituentTokens: tokenAddresses,
//         tokenBalances: startBalances,
//         tokenWeights: startWeights,
//         swapFee: swapFee,
//     };

//     POOL = await crpFactory.newCrp.call(
//         bfactory.address,
//         poolParams,
//         permissions,
//     );

//     await crpFactory.newCrp(
//         bfactory.address,
//         poolParams,
//         permissions,
//     );

//     const pool = await ConfigurableRightsPool.at(POOL);

//     await usdc.approve(POOL, MAX);
//     await dai.approve(POOL, MAX);
//     await primetoken.approve(POOL, MAX);

//     await pool.createPool(toWei('1000'), 10, 10);

//     // move ownership to avatar
//     await pool.setController(setup.organization.avatar.address);

//     // deploy proxy
//     const proxy = await BalancerProxy.new();
//     // initialize proxy
//     await proxy.initialize(setup.organization.avatar.address, pool.address, await pool.bPool());

//     return { pool, proxy };
// };

// const DAOStack = async () => {
//     const controllerCreator = await ControllerCreator.new();
//     const daoTracker = await DAOTracker.new();
//     const daoCreator = await DaoCreator.new(controllerCreator.address, daoTracker.address);

//     return { controllerCreator, daoTracker, daoCreator };
// };

const organization = async (setup) => {
    // deploy organization
    const organization = await deployOrganization(setup.DAOStack.daoCreator, [setup.root], [PDAO_TOKENS], [REPUTATION]);

    return organization;
};

// const token4rep = async (setup) => {
//     const priceOracle = await PriceOracle.new();

//     await priceOracle.setTokenPrice(setup.tokens.primeToken.address, 100, 4);
//     // scheme parameters
//     const params = {
//         reputationReward: 850000,
//         lockingStartTime: await time.latest(), // start of the locking period
//         lockingEndTime: (await time.latest()).add(await time.duration.days(30)), // one month after the start of the locking period
//         redeemEnableTime: (await time.latest()).add(await time.duration.weeks(6)), // 6 weeks after the start of the locking period
//         maxLockingPeriod: (180*60*60), // 6 months
//         agreementHash: "0x0000000000000000000000000000000000000000"
//     };

//     // deploy token4rep contract
//     const contract = await LockingToken4Reputation.new();
//     // initialize token4rep contract
//     await contract.initialize(
//         setup.organization.avatar.address,
//         params.reputationReward,
//         params.lockingStartTime,
//         params.lockingEndTime,
//         params.redeemEnableTime,
//         params.maxLockingPeriod,
//         priceOracle.address,
//         params.agreementHash
//     );

//     return { params, contract, priceOracle };
// };

// const primeDAO = async (setup) => {
//     // deploy balancer generic scheme
//     const poolManager = await GenericScheme.new();
//     // deploy balancer scheme voting machine
//     poolManager.voting = await setAbsoluteVote(constants.ZERO_ADDRESS, 50, poolManager.address);
//     // initialize balancer scheme
//     await poolManager.initialize(setup.organization.avatar.address, poolManager.voting.absoluteVote.address, poolManager.voting.params, setup.balancer.proxy.address);

//     // setup farmManager
//     const farmManager = await GenericSchemeMultiCall.new();
//     // deploy farmFactory scheme voting machine
//     farmManager.voting = await setAbsoluteVote(constants.ZERO_ADDRESS, 50, farmManager.address);

//     await farmManager.initialize(setup.organization.avatar.address, farmManager.voting.absoluteVote.address, farmManager.voting.params, constants.ZERO_ADDRESS);

//     // setup farmManager
//     const multicallScheme = await GenericSchemeMultiCall.new();
//     // deploy farmFactory scheme voting machine
//     multicallScheme.voting = await setAbsoluteVote(constants.ZERO_ADDRESS, 50, farmManager.address);

//     await multicallScheme.initialize(setup.organization.avatar.address, multicallScheme.voting.absoluteVote.address, multicallScheme.voting.params, constants.ZERO_ADDRESS);


//     // register schemes
//     const permissions = '0x00000010';
//     await setup.DAOStack.daoCreator.setSchemes(
//         setup.organization.avatar.address,
//         [setup.balancer.proxy.address, setup.balancer.pool.address, setup.token4rep.contract.address, poolManager.address, setup.farmFactory.address, farmManager.address, multicallScheme.address],
//         [constants.ZERO_BYTES32, constants.ZERO_BYTES32, constants.ZERO_BYTES32, constants.ZERO_BYTES32, constants.ZERO_BYTES32, constants.ZERO_BYTES32, constants.ZERO_BYTES32],
//         [permissions, permissions, permissions, permissions, permissions, permissions, permissions],
//         'metaData'
//     );

//     return {poolManager, farmManager, multicallScheme};
// };

module.exports = {
    initialize,
    // incentives,
    // repRedeemer,
    tokens,
    // balancer,
    // DAOStack,
    organization,
    // farmFactory,
    seed,
    // seedFactory,
    // token4rep,
    // primeDAO,
};
