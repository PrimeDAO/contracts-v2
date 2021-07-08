const {expect} = require('chai');
const { ethers } = require("hardhat");
const { Contract } = require('ethers');

const init = require("../test-init.js");
const { VaultFactory }= require('../helpers/VaultFactory')
const { TokenList } = require('../helpers/TokenList')

const deploy = async () => {
	const setup = await init.initialize(await ethers.getSigners());

	// setup.vault = VaultFactory.deployVault(setup);

	// setup.lbpFactory = await init.lbpFactory(setup);

	setup.tokens = await init.tokens(setup);

	return setup
}

describe("LbpFactory", async () => {
	let vault;
	let setup;
	let poolTokens;

	describe("test factory", async () => {
		before('setup', async () => {
			setup = await deploy();

			poolTokens = await TokenList.create(['Dai', 'Prime'], setup.roles.prime)

			//example from balancer test

			// async function createPool(swapsEnabled = true) {
			// 	const receipt = await (
			// 	  await factory.create(
			// 		NAME,
			// 		SYMBOL,
			// 		tokens.addresses,
			// 		WEIGHTS,
			// 		POOL_SWAP_FEE_PERCENTAGE,
			// 		ZERO_ADDRESS,
			// 		swapsEnabled
			// 	  )
			// 	).wait();

		});
		it('random'), async () => {
			// const log = vault§
			console.log(vault.address)
		}
	});
});