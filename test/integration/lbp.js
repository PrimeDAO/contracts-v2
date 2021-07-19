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

	setup.vault = await balancer.Vault(setup);
	
	setup.lbpFactory = await balancer.LBPFactory(setup);
	
	setup.gnosisSafe = await init.gnosisSafe(setup);

    setup.proxySafe = await init.gnosisProxy(setup);
	
	// setup.Lbp = balancer.Lbp(setup);

	setup.tokenList = await tokens.ERC20TokenList(2, setup.roles.root);

	setup.data = {};

	return setup
}

describe("LbpFactory", async () => {
	let setup;
	let swapsEnabled;
	let tokenAddresses;
	let Signer_Factory;
	let lbpFactoryFunctionSelector;
	let nonce = 0;

	const NAME = "Test";
	const SYMBOL = "TT";
	const WEIGHTS = [parseEther('0.6').toString(), parseEther('0.4')];
	const POOL_SWAP_FEE_PERCENTAGE = parseEther('0.01').toString()
	const ZERO_ADDRESS = constants.ZERO_ADDRESS;
	const zero = 0;
	const oneMillion = 1000000;
	const SIGNATURE_CREATED = 'SignatureCreated';
	const signaturePosition = 196;
	const magicValue = `0x20c13b0b`;



	context("test factory EOA", async () => {
		before('setup', async () => {

			setup = await deploy();
			
			swapsEnabled = true;
			tokenAddresses = [setup.tokenList[0].address, setup.tokenList[1].address];

			// Get function selector from lbpFactory.create
			const {data} = await setup.lbpFactory.populateTransaction.create(
				NAME,
				SYMBOL,
				tokenAddresses,
				WEIGHTS,
				POOL_SWAP_FEE_PERCENTAGE,
				ZERO_ADDRESS,
				swapsEnabled
				);
				lbpFactoryFunctionSelector = data.substring(0, 10);

			// Deploy signer contract with lbpFactoryFunctionSelector
			Signer_Factory = await ethers.getContractFactory(
				"Signer",
				setup.roles.root
			);
			setup.signer = await Signer_Factory.deploy(setup.proxySafe.address);
			setup.signer.addFactory(setup.lbpFactory.address, lbpFactoryFunctionSelector)


		
		});
		it('deploys new LBP pool', async () => {
			// Add owners to gonsis safe
			await setup.proxySafe.connect(setup.roles.prime).setup(
				[setup.signer.address, setup.roles.prime.address],
				1,
				setup.proxySafe.address,
				'0x',
				constants.ZERO_ADDRESS,
				constants.ZERO_ADDRESS,
				0,
				setup.roles.prime.address
			);

			// Create transaction
			const { data, to } = await setup.lbpFactory.populateTransaction.create(
				NAME,
				SYMBOL,
				tokenAddresses,
				WEIGHTS,
				POOL_SWAP_FEE_PERCENTAGE,
				setup.proxySafe.address,
				swapsEnabled
			);
			const trx = [
				to,
				zero,
				data,
				zero,
				oneMillion,
				oneMillion,
				zero,
				ZERO_ADDRESS,
				ZERO_ADDRESS
			];
            const transaction = await setup.signer.generateSignature(...trx, nonce);
			const hashData = await setup.proxySafe.encodeTransactionData(...trx, nonce);

			nonce++;
            const receipt = await transaction.wait();
			const {signature, hash} = receipt.events.filter((data) => {return data.event === SIGNATURE_CREATED})[0].args;
            trx.push(signature);
            setup.data.trx = trx;
            setup.data.hash = hash;

            // checking if the signature produced can correctly be verified by signer contract.
            expect(await setup.signer.isValidSignature(hashData,`0x${signature.slice(signaturePosition)}`)).to.equal(magicValue);

			// Execute signed transaction to launch the LBP pool
			const receipt1 = await setup.proxySafe.connect(setup.roles.prime).execTransaction(...setup.data.trx);

		
			// const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
			// setup.lbp = setup.Lbp.attach(poolAddress);
			// expect(await setup.lbp.name()).to.equal(NAME);
			// expect(await setup.lbp.symbol()).to.equal(SYMBOL);
			// expect(await setup.lbp.getSwapEnabled()).to.be.true;
			// await setup.lbp.connect(setup.proxySafe.address).setSwapEnabled(false);
			// expect(await setup.lbp.getSwapEnabled()).to.be.false;

		});
		// it('deploys new LBP pool', async () => {
		// 	const receipt = await (await setup.lbpFactory.create(
		// 		NAME,
		// 		SYMBOL,
		// 		tokenAddresses,
		// 		WEIGHTS,
		// 		POOL_SWAP_FEE_PERCENTAGE,
		// 		setup.proxySafe.address,
		// 		swapsEnabled
		// 	)).wait();

		// 	const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
		// 	setup.lbp = setup.Lbp.attach(poolAddress);
		// 	expect(await setup.lbp.name()).to.equal(NAME);
		// 	expect(await setup.lbp.symbol()).to.equal(SYMBOL);
		// 	// expect(await setup.lbp.getSwapEnabled()).to.be.true;
		// 	// await setup.lbp.connect(setup.proxySafe.address).setSwapEnabled(false);
		// 	// expect(await setup.lbp.getSwapEnabled()).to.be.false;

		// });
	});
});