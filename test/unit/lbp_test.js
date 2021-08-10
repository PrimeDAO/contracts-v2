const {expect} = require('chai');
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../helpers/test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const { time, constants, expectRevert } = require('@openzeppelin/test-helpers');
const { parseUnits } = require('ethers/lib/utils');


const deploy = async () => {
    const setup = await init.initialize(await ethers.getSigners());
	
	setup.vault = await balancer.Vault(setup);

	setup.lbpFactory = await balancer.LBPFactory(setup);

	setup.Lbp = balancer.Lbp(setup);

    setup.gnosisSafe = await init.gnosisSafe(setup);

    setup.proxySafe = await init.gnosisProxy(setup);

	setup.tokenList = await tokens.ERC20TokenList(4, setup.roles.root);

    setup.data = {};

    return setup;
}

describe("LBP Test", async () => {
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
		before("!! setup", async () => {
			setup = await deploy();
	
			tokenAddresses = [setup.tokenList[0].address, setup.tokenList[1].address];
			
			swapEnabledOnStart = true;
			nonce = 0;
			
		});
			it("deploy with success", async () => {
				// console.log(NAME)
				const receipt = await (await setup.lbpFactory.create(
					NAME,
					SYMBOL,
					tokenAddresses,
					START_WEIGHTS,
					SWAP_FEE_PERCENTAGE,
					setup.roles.prime.address,
					swapEnabledOnStart
				)).wait();

				const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
				setup.lbp = setup.Lbp.attach(poolAddress);
				expect(await setup.lbp.name()).to.equal(NAME);
				expect(await setup.lbp.symbol()).to.equal(SYMBOL);
				// console.log(await setup.lbp.getPoolId());
			})

			
			it("checks for balance of user", async () =>{
				expect(await setup.vault.getInternalBalance(
					setup.roles.prime.address,
					tokenAddresses)).to.equal([ethers.BigNumber.from("0"), ethers.BigNumber.from("0")]);		
			});
			it("init pool", async () => {
				const poolId = await setup.lbp.getPoolId();
				// Token 1 price $205, token 2 price $105
				// console.log(parseEther("85.45636518938746742"))
				const initialBalances = [parseUnits("85.36585", 18), parseUnits("216.666", 18)];
				const JOIN_KIND_INIT = 0;


				// Construct magic userData
				const initUserData =
					ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
														[JOIN_KIND_INIT, initialBalances]);
				const joinPoolRequest = {
				assets: tokenAddresses,
				maxAmountsIn: initialBalances,
				userData: initUserData,
				fromInternalBalance: false
				}
				setup.tokenList[0].approve(setup.vault.address, initialBalances[0]);
				setup.tokenList[1].approve(setup.vault.address, initialBalances[1]);

				console.log(await setup.roles.prime.getBalance)
				// joins and exits are done on the Vault, not the pool
				const tx = await setup.vault.connect(setup.roles.prime).joinPool(poolId, setup.roles.prime.address, setup.roles.prime.address, joinPoolRequest);
				// You can wait for it like this, or just print the tx hash and monitor
				const receipt = await tx.wait();



			})

				
		// 		await expectRevert(
		// 			setup.lbpDeployer
		// 			.connect(setup.roles.root)
		// 			.deployLbpFromFactory(
		// 				NAME,
		// 				SYMBOL,
		// 				tokenAddresses,
		// 				START_WEIGHTS,
		// 				swapEnabledOnStart,
		// 				startTime.toNumber(),
		// 				endTime.toNumber(),
		// 				END_WEIGHTS
		// 				),
		// 				"Deployer: only safe function"
		// 				);
		// 	})
		// })
		// context("» deploy lbp pool and updateWeightsGradually", async () => {
		// 	it("it deploys pool", async () => {
		// 		// console.log(tokenAddresses + '\n' + startTime.toNumber()+ '\n' + END_WEIGHTS)
				
		// 		// console.log(END_WEIGHTS)
		// 		await setup.lbpDeployer
		// 		.connect(setup.roles.prime)
		// 		.deployLbpFromFactory(
		// 			NAME,
		// 			SYMBOL,
		// 			tokenAddresses,
		// 			START_WEIGHTS,
		// 			swapEnabledOnStart,
		// 			startTime.toNumber(),
		// 			endTime.toNumber(),
		// 			END_WEIGHTS
		// 			);
		// 			// expect(setup.lbpDeployer)
		// 		});	
	});
});