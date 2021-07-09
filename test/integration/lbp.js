const {expect} = require('chai');
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../helpers/test-init.js");
const balancer = require("../helpers/balancer.js");
const {constants} = require('@openzeppelin/test-helpers');
const expectEvent = require('@openzeppelin/test-helpers/src/expectEvent');

const deploy = async () => {
	const setup = await init.initialize(await ethers.getSigners());

	setup.vault = await balancer.deployVault(setup);

	setup.lbpFactory = await balancer.LBPFactory(setup);

	setup.Lbp = balancer.Lbp(setup);

	setup.token = await init.tokens(setup);

	return setup
}

describe("LbpFactory", async () => {
	let setup;
	let swapsEnabled;
	let tokenAddresses;

	const NAME = "Test";
	const SYMBOL = "TT";
	const WEIGHTS = [parseEther('0.6').toString(), parseEther('0.4')];
	const POOL_SWAP_FEE_PERCENTAGE = parseEther('0.01').toString()
	const ZERO_ADDRESS = constants.ZERO_ADDRESS

	context("test factory", async () => {
		before('setup', async () => {

			setup = await deploy();
			
			swapsEnabled = true;
			tokenAddresses = [setup.token.fundingToken.address, setup.token.fundingToken2.address];
		
		});
		it('deploys new LBP pool', async () => {
			const receipt = await (await setup.lbpFactory.create(
				NAME,
				SYMBOL,
				tokenAddresses,
				WEIGHTS,
				POOL_SWAP_FEE_PERCENTAGE,
				ZERO_ADDRESS,
				swapsEnabled
			)).wait();

			const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
			setup.lbp = setup.Lbp.attach(poolAddress);
			expect(await setup.lbp.name()).to.equal(NAME);
			expect(await setup.lbp.symbol()).to.equal(SYMBOL);
		});
	});
});