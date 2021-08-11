const {expect} = require('chai');
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../helpers/test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const {constants, BN} = require('@openzeppelin/test-helpers');

const deploy = async () => {
	const setup = await init.initialize(await ethers.getSigners());
	
	setup.vault = await balancer.Vault(setup);
	
	setup.lbpFactory = await balancer.LBPFactory(setup);
	
	setup.Lbp = balancer.Lbp(setup);

	setup.tokenList = await tokens.ERC20TokenList(2, setup.roles.root);

	return setup
}

describe("Interaction with LBP", async () => {
	let setup;
	let swapsEnabled;
	let tokenAddresses;
	const NAME = "Test";
	const SYMBOL = "TT";
	let startTime = Date.now();
	let endTime = startTime+100000;
	let WEIGHTS = [parseEther('0.6').toString(), parseEther('0.4')];
	const END_WEIGHTS = [parseEther('0.4').toString(), parseEther('0.6')];
	const POOL_SWAP_FEE_PERCENTAGE = parseEther('0.01').toString();
	const ZERO_ADDRESS = constants.ZERO_ADDRESS;

	context("deploy LBP", async () => {
		before("!! setup", async () => {
			setup = await deploy();
			swapsEnabled = true;
			tokenAddresses = [setup.tokenList[1].address, setup.tokenList[0].address];
		})
		it("deploy LBP", async () => {
			const receipt = await (await setup.lbpFactory.create(
				NAME,
				SYMBOL,
				tokenAddresses,
				WEIGHTS,
				POOL_SWAP_FEE_PERCENTAGE,
				setup.roles.prime.address, // owner address
				swapsEnabled
			)).wait();

			const poolAddress = receipt.events.filter((data) => {return data.event === 'PoolCreated'})[0].args.pool;
			setup.lbp = setup.Lbp.attach(poolAddress);
			expect(await setup.lbp.getOwner()).to.equal(setup.roles.prime.address)
			expect(await setup.lbp.name()).to.equal(NAME);
			expect(await setup.lbp.symbol()).to.equal(SYMBOL);
		});
		it("reverts when Updates weight gradually called from not authorized account", async () => {
			await expect(
				setup.lbp.connect(setup.roles.root).updateWeightsGradually(startTime, endTime, END_WEIGHTS)
			).to.be.revertedWith('BAL#401');
		});
		it("Updates weight gradually called from authorized account", async () => {
			await expect(
				setup.lbp.connect(setup.roles.prime).updateWeightsGradually(startTime, endTime, END_WEIGHTS)
			).to.emit(setup.lbp, 'GradualWeightUpdateScheduled')
			.withArgs(startTime, endTime, WEIGHTS, END_WEIGHTS);
		});
	});
	context("Join pool", async () => {
		let initUserData;
		let request;
		let poolId;
		before("!! setup for joining pool", async () => {
			WEIGHTS = [parseEther('600').toString(), parseEther('400')];
			initUserData =ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                        [0, WEIGHTS]);
			poolId = await setup.lbp.getPoolId();
			request = {
				maxAmountsIn: WEIGHTS,
            	userData: initUserData,
            	fromInternalBalance: false,
            	assets: tokenAddresses
			};
			await setup.tokenList[0].connect(setup.roles.root).transfer(setup.roles.prime.address, WEIGHTS[1]);
			await setup.tokenList[1].connect(setup.roles.root).transfer(setup.roles.prime.address, WEIGHTS[0]);
			await setup.tokenList[0].connect(setup.roles.prime).approve(setup.vault.address, WEIGHTS[1]);
			await setup.tokenList[1].connect(setup.roles.prime).approve(setup.vault.address, WEIGHTS[0]);
			await setup.tokenList[0].connect(setup.roles.root).transfer(setup.roles.prime.address, WEIGHTS[1]);
			await setup.tokenList[1].connect(setup.roles.root).transfer(setup.roles.prime.address, WEIGHTS[0]);
		});
		it("reverts when msg.sender is not owner", async () => {
			await expect(setup.vault.connect(setup.roles.root).joinPool(
				poolId,
				setup.roles.root.address,
				setup.roles.root.address,
				request
			)).to.be.revertedWith("BAL#328"); // Caller is not LBP owner // talking about msg.sender
		});
		it("reverts when sender is not owner", async () => {
			await expect(setup.vault.connect(setup.roles.prime).joinPool(
				poolId,
				setup.roles.root.address,
				setup.roles.root.address,
				request
			)).to.be.revertedWith("BAL#401"); // Sender not allowed // talking about sender parameter
		});
		it("Joins pool", async () => {
			// msg.sender needs to be owner
			// sender needs to be owner
			// anyone can be receiver
			const receipt = await (await setup.vault.connect(setup.roles.prime).joinPool(
				poolId,
				setup.roles.prime.address,
				setup.roles.root.address,
				request
			)).wait();
		});
		it("it cannot add more liquidity later on with incorrect join request", async () => {
			initUserData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                        [0, WEIGHTS]);
			request = {
				maxAmountsIn: WEIGHTS,
            	userData: initUserData,
            	fromInternalBalance: false,
            	assets: tokenAddresses
			};
			await expect(setup.vault.connect(setup.roles.prime).joinPool(
				poolId,
				setup.roles.prime.address,
				setup.roles.root.address,
				request
			)).to.be.revertedWith("BAL#310"); // UNHANDLED_JOIN_KIND
		});
		it("it can add more liquidity later on with correct join request", async () => {
			WEIGHTS = [parseEther('0.5').toString(), parseEther('0.1')]
			await setup.tokenList[0].connect(setup.roles.prime).approve(setup.vault.address, WEIGHTS[1]);
			await setup.tokenList[1].connect(setup.roles.prime).approve(setup.vault.address, WEIGHTS[0]);
			initUserData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                        [1, WEIGHTS]);
			request = {
				maxAmountsIn: WEIGHTS,
            	userData: initUserData,
            	fromInternalBalance: false,
            	assets: tokenAddresses
			};
			await expect(setup.vault.connect(setup.roles.prime).joinPool(
				poolId,
				setup.roles.prime.address,
				setup.roles.root.address,
				request
			)).to.emit(setup.vault, "PoolBalanceChanged")
		});
	});
	context("Swap Tokens", async () => {
		context("single swap", async () => {
			it("swaps", async () => {
				setup.tokenList[1].approve(setup.vault.address, parseEther('0.01').toString());
				const singleSwap = {
					poolId: await setup.lbp.getPoolId(),
					kind: 0,
					assetIn: setup.tokenList[1].address,
					assetOut: setup.tokenList[0].address,
					amount: parseEther('0.01').toString(),
					userData: '0x'
				};
				const funds = {
					sender: setup.roles.root.address,
					fromInternalBalance: false,
					recipient: setup.roles.root.address,
					toInternalBalance: false
				};
				// const data = await setup.lbp.onSwap(singleSwap)
				await expect(
					setup.vault.connect(setup.roles.root)
						.swap(singleSwap, funds, parseEther('0.001').toString(), Date.now()+1000)).to.not.be.reverted;
			});
		});
	});
	context("Exit Pool", async () => {
		it("gets pool balance", async () => {
			const rawInfo = (await setup.vault.getPoolTokens(await setup.lbp.getPoolId()));
			const tokens = rawInfo.tokens;
			const balances = [rawInfo.balances[0].toString(), rawInfo.balances[1].toString()];
			// console.log(tokens, balances);
			initUserData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
										[1, balances]);
			request = {
				minAmountsOut: balances,
            	userData: initUserData,
            	toInternalBalance: false,
            	assets: tokens
			}
			const poolId = await setup.lbp.getPoolId();
			console.log((await setup.lbp.getInvariant()).toString());
			await expect(setup.vault.connect(setup.roles.root).exitPool(
				poolId,
				setup.roles.root.address,
				setup.roles.root.address,
				request
			)).to.emit(setup.vault, "PoolBalanceChanged")
		});
	});
	context("Getter Functions", async () => {

	});
	context("Authorized Functionality", async () => {

	});
})