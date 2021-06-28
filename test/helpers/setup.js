// const { concat } = require('ethers/lib/utils');
const hre = require("hardhat")
const { parseUnits } = ethers.utils;
// const { toTwos } = ethers.BigNumber;

const Seed = hre.artifacts.readArtifact("Seed");
const ERC20 = hre.artifacts.readArtifact("ERC20Mock")
const PrimeToken = hre.artifacts.readArtifact('PrimeToken');

// const MAX = ethers.BigNumber.toTwos(-1); <<<<<<<<<<<<<<< // WHy does this one not work?
const MAX = web3.utils.toTwosComplement(-1);
// console.log(Max)

const PRIME_CAP = parseUnits('90000000').toString();
const PRIME_SUPPLY = parseUnits('21000000').toString();

const DAI_START_BALANCE = parseUnits('5000').toString();
const USDC_START_BALANCE = parseUnits('5000').toString();

const initialize = async (root) => {
    const setup = {};
    setup.root = root;
    setup.data = {};
    setup.data.balances = [];
    return setup;
};

const tokens = async (setup) => {

	const ERC20F = await hre.ethers.getContractFactory("ERC20", setup.root);
    await ERC20F.attach(setup.root.address);
    const test = await ERC20F.deploy('DAI2 Stablecoin', 'DAI4')
	const erc20s = [await ERC20F.deploy('DAI Stablecoin', 'DAI'), await ERC20F.deploy('USDC Stablecoin', 'USDC'), await ERC20F.deploy('USDT Stablecoin', 'USDT')];
    // await erc20s[0].deployed();

    // require(await test.signer == setup.root)

    // console.log(test.signer);
    // console.log(setup.root);

    if (test.signer == setup.root)
    {
        console.log("owner of contract and setup.root are the same")
    }

    console.log("balance new ERC20 contract = " + (await test.totalSupply()).toString());
    // await test.deployed();
    // await test.attach(setup.root.address)
    // await erc20s[1].deployed();

    // await erc20s[1].deployed();
	
    // console.log(await erc20s[0].balanceOf(erc20s[0].address))
    // await erc20s[0].approve(setup.root.address, MAX);
    // console.log(await erc20s[0].balanceOf(setup.root.address));

	const primeTokenF = await hre.ethers.getContractFactory("PrimeToken");
	const primeToken = await primeTokenF.deploy(PRIME_SUPPLY, PRIME_CAP, setup.root.address);
    
    // const proxy = await test.connect(setup.root.address)
    // const dai = erc20s[0];
    // const usdc = erc20s[1];
    const ownerBalance = await test.balanceOf(setup.root.address);
    const ownerBalance1 = await primeToken.balanceOf(setup.root.address);


    // await dai.approve(setup.root.address, MAX);
    // await usdc.approve(setup.root.address, MAX);
    console.log("owner balans erc = " + ownerBalance)
    console.log("owner balans prime = " + ownerBalance1)
    // // console.log("here33")
    // console.log(await dai.totalSupply());
    // console.log("Here25")

	return { erc20s, primeToken};
};

const seed = async () => {
	const seedF = await hre.ethers.getContractFactory("Seed");
    const seed = await seedF.deploy();

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
    tokens,
    // balancer,
    // DAOStack,
    // organization,
    // farmFactory,
    seed,
    // seedFactory,
    // token4rep,
    // primeDAO,
};
