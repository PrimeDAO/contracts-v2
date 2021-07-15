const {expect} = require('chai');
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../helpers/test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const {constants} = require('@openzeppelin/test-helpers');
const expectEvent = require('@openzeppelin/test-helpers/src/expectEvent');

const deploy = async () => {
	const setup = await init.initialize(await ethers.getSigners());

	// Signer_Factory = await ethers.getContractFactory(
	// 	"Signer",
	// 	setup.roles.root
	// );

	setup.vault = await balancer.Vault(setup);
	
	setup.lbpFactory = await balancer.LBPFactory(setup);
	
	setup.gnosisSafe = await init.gnosisSafe(setup);

    setup.proxySafe = await init.gnosisProxy(setup);
	
	setup.Lbp = balancer.Lbp(setup);

	setup.tokenList = await tokens.ERC20TokenList(2, setup.roles.root);

	return setup
}

describe("LbpFactory", async () => {
	let setup;
	let swapsEnabled;
	let tokenAddresses;
	let Signer_Factory;

	const NAME = "Test";
	const SYMBOL = "TT";
	const WEIGHTS = [parseEther('0.6').toString(), parseEther('0.4')];
	const POOL_SWAP_FEE_PERCENTAGE = parseEther('0.01').toString()
	const ZERO_ADDRESS = constants.ZERO_ADDRESS

	context("test factory EOA", async () => {
		before('setup', async () => {

			setup = await deploy();
			// Signer_Factory = await ethers.getContractFactory(
			// 	"Signer",
			// 	setup.roles.root
			// );

			swapsEnabled = true;
			tokenAddresses = [setup.tokenList[0].address, setup.tokenList[1].address];
		
		});
		it('deploys new LBP pool', async () => {
			const receipt = await (await setup.lbpFactory.create(
				NAME,
				SYMBOL,
				tokenAddresses,
				WEIGHTS,
				POOL_SWAP_FEE_PERCENTAGE,
				setup.proxySafe.address,
				swapsEnabled
			)).wait();

			const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
			setup.lbp = setup.Lbp.attach(poolAddress);
			expect(await setup.lbp.name()).to.equal(NAME);
			expect(await setup.lbp.symbol()).to.equal(SYMBOL);
			expect(await setup.lbp.getSwapEnabled()).to.be.true;
			await setup.lbp.connect(setup.proxySafe.address).setSwapEnabled(false);
			expect(await setup.lbp.getSwapEnabled()).to.be.false;

		});
	});
	// context("test factory GnosisSafeProxi", async () => {
	// 	before('setup', async () => {

	// 		setup = await deploy();

	// 		swapsEnabled = true;
	// 		tokenAddresses = [setup.tokenList[0].address, setup.tokenList[1].address];
		
	// 	});
	// 	it('deploys new LBP pool', async () => {
	// 		const receipt = await (await setup.lbpFactory.create(
	// 			NAME,
	// 			SYMBOL,
	// 			tokenAddresses,
	// 			WEIGHTS,
	// 			POOL_SWAP_FEE_PERCENTAGE,
	// 			ZERO_ADDRESS,
	// 			swapsEnabled
	// 		)).wait();

	// 		const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
	// 		setup.lbp = setup.Lbp.attach(poolAddress);
	// 		expect(await setup.lbp.name()).to.equal(NAME);
	// 		expect(await setup.lbp.symbol()).to.equal(SYMBOL);
	// 	});
	// });
});