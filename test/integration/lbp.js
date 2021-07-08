const {expect} = require('chai');
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../test-init.js");
const {constants} = require('@openzeppelin/test-helpers');
const expectEvent = require('@openzeppelin/test-helpers/src/expectEvent');

const deploy = async () => {
	const setup = await init.initialize(await ethers.getSigners());

	setup.vault = await init.deployVault(setup);

	setup.lbpFactory = await init.deployLBPFactory(setup);

	setup.Lbp = init.Lbp(setup);

	setup.token = await init.tokens(setup);

	return setup
}

describe("LbpFactory", async () => {
	let vault;
	let setup;
	let poolTokens;
	let lbp;

	context("test factory", async () => {
		before('setup', async () => {
			setup = await deploy();
		});
		it('deploys new LBP pool', async () => {
			const receipt = await (await setup.lbpFactory.create(
				"Test",
				"TT",
				[setup.token.fundingToken.address, setup.token.fundingToken2.address],
				[parseEther('0.6').toString(), parseEther('0.4')],
				parseEther('0.01').toString(),
				constants.ZERO_ADDRESS,
				true
			)).wait();
			const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
			setup.lbp = setup.Lbp.attach(poolAddress);
			expect(await setup.lbp.name()).to.equal("Test");
			expect(await setup.lbp.symbol()).to.equal("TT");
		});
	});
});