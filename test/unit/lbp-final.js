const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { parseEther, parseUnits } = ethers.utils;
const { time, constants, expectRevert, BN } = require('@openzeppelin/test-helpers');


const init = require("../helpers/test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");



// const deploy = async () => {
// 	const setup = await init.initialize(await ethers.getSigners());
	
// 	setup.vault = await balancer.Vault(setup);

// 	setup.lbpFactory = await balancer.LBPFactory(setup);


// 	setup.tokenList = await tokens.ERC20TokenList(4, setup.roles.root);

// 	return setup;
// }

const setupFixture = deployments.createFixture(
		async ({ deployments }, options) => {
		await deployments.fixture(["LbpWrapper"])
		const { deploy } = deployments;
		const signers = await ethers.getSigners();
		const root = signers[0];
		const SWAP_FEE_PERCENTAGE = parseEther('0.01').toString();

		
		const Vault = await balancer.Vault();
		const LbpFactory = await balancer.LBPFactory(Vault);

		await deploy("WrapperFactory", {
			contract: "WrapperFactory",
			from: root.address,
			args: [LbpFactory.address, SWAP_FEE_PERCENTAGE],
			log: true
		})
		await deploy("LbpWrapper", {
			contract: "LBPWrapper",
			from: root.address,
			log: true
		})

		const contractInstances = {
			lbpFactory: LbpFactory,
			tokens: await tokens.ERC20TokenList(2, root),
			lbpInstance: await balancer.Lbp(root),
			vault: Vault,
			lbpWrapper: await ethers.getContract("LbpWrapper"),
			wrapperFactory: await ethers.getContract("WrapperFactory")
		};

		return { ...contractInstances };
	}
);

function sortToken(tokens) {
	if (tokens[0].address > tokens[1].address) {
		const temp = tokens[0];
		tokens[0] = tokens[1];
		tokens[1] = temp;
	}
	return tokens;
	
}

// const setupInitialState = async (contractInstances, initialStat) => {

// 	const signers = await ethers.getSigners();
// 	const [root, prime] = signers;
// 	const addresses = signers.map((signer) => signer.address);
// 	const { lbpWrapper, lbpFactory } = contractInstances;

// 	const {
// 		NAME,
// 		SYMBOL,
// 		tokenAddresses,
// 		START_WEIGHTS,
// 		SWAP_FEE_PERCENTAGE,
// 		owner,
// 		swapEnabledOnStart
// 	} = initialStat;


// 	// return { Lbp, poolId, }
// }


describe(">> LBP Wrapper", () => {
	let now, startTime, endTime;
	let prime;
	let setup;
	let poolId;
	let contractInstances, tokens, lbpFactory, tokenAddresses, lbpInstance, vault;

	
	describe("# LBP through factory", async () => {
		setup = {}
		now = await time.latest();
		const UPDATE_DURATION = await time.duration.minutes(60);
		startTime = await now.add(await time.duration.minutes(10));
		endTime = await startTime.add(UPDATE_DURATION);

		const NAME = "Test";
		const SYMBOL = "TT";
		const SWAP_FEE_PERCENTAGE = parseEther('0.01').toString()
		const START_WEIGHTS = [
			parseEther('0.35').toString(), parseEther('0.65').toString()];
		const END_WEIGHTS = [
			parseEther('0.15').toString(), parseEther('0.85').toString()];


		describe("$ Create pool with factory", async () => {
			before(async () => {

				const signers =  await init.initialize(await ethers.getSigners());
				prime = signers.roles.prime;
				
				contractInstances = await setupFixture();
				({ lbpFactory, tokens, lbpInstance, vault } = contractInstances);
		
				//Need way to sort  more than 2 tokens, solve in token helper file !!!!!!!
				const sortedTokens = sortToken(tokens);
				tokenAddresses = [sortedTokens[0].address, sortedTokens[1].address];

			});
			
			it("$ creates valid pool from factory", async () => {
				const receipt = await (await lbpFactory.create(
					NAME,
					SYMBOL,
					tokenAddresses,
					START_WEIGHTS,
					SWAP_FEE_PERCENTAGE,
					prime.address,
					true
				)).wait();

				const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
				setup.lbp = lbpInstance.attach(poolAddress);
				expect(await setup.lbp.name()).to.equal(NAME);
				expect(await setup.lbp.symbol()).to.equal(SYMBOL);
			});
			it("$ joins pool", async () => {

				poolId = await setup.lbp.getPoolId();

				// Token 1 price $205, token 2 price $105
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
				//This has to change with the sorting of tokens
				tokens[1].approve(vault.address, initialBalances[0]);
				tokens[0].approve(vault.address, initialBalances[1]);

				// joins and exits are done on the Vault, not the pool
				const tx = await vault.connect(prime).joinPool(poolId, prime.address, prime.address, joinPoolRequest);
				// You can wait for it like this, or just print the tx hash and monitor
				const receipt = await tx.wait();
			})
		})		
	})
	// describe("# LBP through Wrapper", async () => {
	// 	setup = {}
	// 	now = await time.latest();
	// 	const UPDATE_DURATION = await time.duration.minutes(60);
	// 	startTime = await now.add(await time.duration.minutes(10));
	// 	endTime = await startTime.add(UPDATE_DURATION);

	// 	const NAME = "Test";
	// 	const SYMBOL = "TT";
	// 	const SWAP_FEE_PERCENTAGE = parseEther('0.01').toString()
	// 	const START_WEIGHTS = [
	// 		parseEther('0.35').toString(), parseEther('0.65').toString()];
	// 	const END_WEIGHTS = [
	// 		parseEther('0.15').toString(), parseEther('0.85').toString()];


	// 	describe("$ Create pool through wrapper", async () => {
	// 		before(async () => {

	// 			const signers =  await init.initialize(await ethers.getSigners());
	// 			prime = signers.roles.prime;
				
	// 			contractInstances = await setupFixture();
	// 			({	tokens,
	// 				lbpInstance,
	// 				vault,
	// 				wrapperFactory,
	// 				lbpWrapper
	// 			} = contractInstances);

	// 			await wrapperFactory.setMasterCopy(lbpWrapper.address);
		
	// 			//Need way to sort tokens, solve in token helper file !!!!!!!
	// 			const sortedTokens = sortToken(tokens);
	// 			tokenAddresses = [sortedTokens[0].address, sortedTokens[1].address];

	// 		});
			
	// 		it("$ creates valid pool", async () => {
				
	// 			const receipt = await (await lbpFactory.create(
	// 				NAME,
	// 				SYMBOL,
	// 				tokenAddresses,
	// 				START_WEIGHTS,
	// 				SWAP_FEE_PERCENTAGE,
	// 				prime.address,
	// 				true
	// 			)).wait();

	// 			const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
	// 			setup.lbp = lbpInstance.attach(poolAddress);
	// 			expect(await setup.lbp.name()).to.equal(NAME);
	// 			expect(await setup.lbp.symbol()).to.equal(SYMBOL);
	// 		});
	// 		it("$ joins pool", async () => {
	// 			poolId = await setup.lbp.getPoolId();

	// 			// Token 1 price $205, token 2 price $105
	// 			const initialBalances = [parseUnits("85.36585", 18), parseUnits("216.666", 18)];
	// 			const JOIN_KIND_INIT = 0;

	// 			// Construct magic userData
	// 			const initUserData =
	// 				ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
	// 													[JOIN_KIND_INIT, initialBalances]);
	// 			const joinPoolRequest = {
	// 			assets: tokenAddresses,
	// 			maxAmountsIn: initialBalances,
	// 			userData: initUserData,
	// 			fromInternalBalance: false
	// 			}
	// 			//This has to change with the sorting of tokens
	// 			tokens[1].approve(vault.address, initialBalances[0]);
	// 			tokens[0].approve(vault.address, initialBalances[1]);

	// 			// joins and exits are done on the Vault, not the pool
	// 			const tx = await vault.connect(prime).joinPool(poolId, prime.address, prime.address, joinPoolRequest);
	// 			// You can wait for it like this, or just print the tx hash and monitor
	// 			const receipt = await tx.wait();
	// 		})
	
	// 	})
				
	// })
})
