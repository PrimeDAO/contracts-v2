const {expect} = require('chai');
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../helpers/test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const { time, constants, expectRevert } = require('@openzeppelin/test-helpers');


const deploy = async () => {
    const setup = await init.initialize(await ethers.getSigners());
	
	setup.vault = await balancer.Vault(setup);

	setup.lbpFactory = await balancer.LBPFactory(setup);

    setup.gnosisSafe = await init.gnosisSafe(setup);

    setup.proxySafe = await init.gnosisProxy(setup);

	setup.tokenList = await tokens.ERC20TokenList(4, setup.roles.root);

    setup.data = {};

    return setup;
}

describe('Contract: LBPDeployer', async () => {
	let setup;
	let swapEnabledOnStart;
	let now;
	let startTime;
	let endTime;
	let nonce;


	// Parameters to initialize LBPDeployer contract
	const NAME = "Test";
	const SYMBOL = "TT";
	const SWAP_FEE_PERCENTAGE = parseEther('0.01').toString()
	// const ZERO_ADDRESS = constants.ZERO_ADDRESS
	const START_WEIGHTS = [
		parseEther('0.35').toString(), parseEther('0.65').toString()];
	const END_WEIGHTS = [
		parseEther('0.15').toString(), parseEther('0.85').toString()];
	const UPDATE_DURATION = await time.duration.minutes(60);
	now = await time.latest();
	startTime = await now.add(await time.duration.minutes(10));
	endTime = await startTime.add(UPDATE_DURATION);

	// Paramters to create trx for gnosisSafe
	const ZERO = 0;
	const ONE_MILLION = 1000000;
	const MAGIC_VALUE = `0x20c13b0b`;
	const SIGNATURE_POSITION = 196;
	const SIGNATURE_CREATED = 'SignatureCreated';
	
	context("» without Gnosis Safe", async () => {
		before('!! setup', async () => {
			setup = await deploy();
	
			tokenAddresses = [setup.tokenList[0].address, setup.tokenList[1].address];
			
			swapEnabledOnStart = true;
			nonce = 0;
			// console.log(setup.vault.address);
			const ILBPDeployerFactory = await ethers.getContractFactory(
				"LBPDeployer",
				setup.roles.prime
			);
	
			setup.lbpDeployer = await ILBPDeployerFactory.deploy(
				setup.roles.prime.address, setup.lbpFactory.address, SWAP_FEE_PERCENTAGE);

			// console.log(setup.lbpFactory.address)
			
		});
		context("» deploy LBPDeployer", async () => {

			it("deployes valid LBPDeployer contract", async () => {
				expect(await setup.lbpDeployer.safe()).to.equal(setup.roles.prime.address);
				expect(await setup.lbpDeployer.LBPFactory()).to.equal(setup.lbpFactory.address);
				expect(await setup.lbpDeployer.swapFeePercentage()).to.equal(SWAP_FEE_PERCENTAGE);
				
			})
			it("reverts on calling from wrong address", async () =>{
				
				await expectRevert(
					setup.lbpDeployer
					.connect(setup.roles.root)
					.deployLbpFromFactory(
						NAME,
						SYMBOL,
						tokenAddresses,
						START_WEIGHTS,
						swapEnabledOnStart,
						startTime.toNumber(),
						endTime.toNumber(),
						END_WEIGHTS
						),
						"Deployer: only safe function"
						);
			})
		})
		context("» deploy lbp pool and updateWeightsGradually", async () => {
			it("it deploys pool", async () => {
				// console.log(tokenAddresses + '\n' + startTime.toNumber()+ '\n' + END_WEIGHTS)
				
				// console.log(END_WEIGHTS)
				await setup.lbpDeployer
				.connect(setup.roles.prime)
				.deployLbpFromFactory(
					NAME,
					SYMBOL,
					tokenAddresses,
					START_WEIGHTS,
					swapEnabledOnStart,
					startTime.toNumber(),
					endTime.toNumber(),
					END_WEIGHTS
					);
					// expect(setup.lbpDeployer)
				});	
		})
	});
		// context("» deploye through Gnosis Safe", async () => {
		// 	before('!! setup', async () => {
		// 		setup = await deploy();

		// 		tokenAddresses = [setup.tokenList[0].address, setup.tokenList[1].address,
		// 			setup.tokenList[2].address, setup.tokenList[3].address];
				
		// 		swapEnabledOnStart = true;
		// 		nonce = 0;

		// 		const ILBPDeployerFactory = await ethers.getContractFactory(
		// 			"LBPDeployer",
		// 			setup.roles.prime
		// 		);
		
		// 		setup.lbpDeployer = await ILBPDeployerFactory.deploy(
		// 			setup.proxySafe.address, setup.lbpFactory.address, SWAP_FEE_PERCENTAGE);

		// 		await setup.proxySafe.connect(setup.roles.prime).setup(
		// 			[setup.roles.prime.address],
		// 			1,
		// 			setup.proxySafe.address,
		// 			'0x',
		// 			constants.ZERO_ADDRESS,
		// 			constants.ZERO_ADDRESS,
		// 			0,
		// 			setup.roles.prime.address
		// 		);
				
		// 	})
		// 	it("creates valid lbpFactory", async () => {
		// 		expect(await setup.lbpDeployer.safe()).to.equal(setup.proxySafe.address);
		// 		expect(await setup.lbpDeployer.LBPFactory()).to.equal(setup.lbpFactory.address);
		// 		expect(await setup.lbpDeployer.swapFeePercentage()).to.equal(SWAP_FEE_PERCENTAGE);

		// 	})
		// 	context("» deployLbpFromFactory", async () => {

		// 		it("reverts on not calling function from safe", async () =>{

		// 			await expectRevert(
		// 				setup.lbpDeployer
		// 				.connect(setup.roles.prime)
		// 				.deployLbpFromFactory(
		// 					NAME,
		// 					SYMBOL,
		// 					tokenAddresses,
		// 					START_WEIGHTS,
		// 					swapEnabledOnStart,
		// 					startTime.toNumber(),
		// 					endTime.toNumber(),
		// 					END_WEIGHTS
		// 				),
		// 				"Deployer: only safe function"
		// 			);
		// 		})
		// 		it("it calls function from the safe", async () =>{

		// 			const { data, to } = await setup.lbpDeployer.populateTransaction
		// 				.deployLbpFromFactory(
		// 					NAME,
		// 					SYMBOL,
		// 					tokenAddresses,
		// 					START_WEIGHTS,
		// 					swapEnabledOnStart,
		// 					startTime.toNumber(),
		// 					endTime.toNumber(),
		// 					END_WEIGHTS
		// 				);
		// 				const trx = [
		// 					to,
		// 					ZERO,
		// 					data,
		// 					ZERO,
		// 					ONE_MILLION,
		// 					ONE_MILLION,
		// 					ZERO,
		// 					constants.ZERO_ADDRESS,
		// 					constants.ZERO_ADDRESS,
		// 				];
					
		// 			const transaction = await setup.lbpDeployer.generateSignature(...trx.slice(1), nonce);
		// 			const hashData = await setup.proxySafe.encodeTransactionData(...trx, nonce);

		// 			nonce++;
		// 			const receipt = await transaction.wait();
		// 			const {hash} = receipt.events.filter((data) => {return data.event === SIGNATURE_CREATED})[0].args;
		// 			trx.push(signature);
		// 			setup.data.trx = trx;
		// 			setup.data.hash = hash;
					
		// 				// checking if the signature produced can correctly be verified by signer contract.
		// 			expect(await setup.lbpDeployer.isValidSignature(hashData,`0x${signature.slice(SIGNATURE_POSITION)}`)).to.equal(MAGIC_VALUE);

		// 			await setup.proxySafe.connect(setup.roles.prime).execTransaction(...(setup.data.trx));
		// 		});	
			// })
		// })
});