const {expect} = require('chai');
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;
const { time, constants, expectRevert, BN } = require('@openzeppelin/test-helpers');

const init = require("../helpers/test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");


const deploy = async () => {
    const setup = await init.initialize(await ethers.getSigners());
	
	setup.vault = await balancer.Vault(setup);

	setup.lbpFactory = await balancer.LBPFactory(setup);

    setup.gnosisSafe = await init.gnosisSafe(setup);

    setup.proxySafe = await init.gnosisProxy(setup);

	setup.tokenList = await tokens.ERC20TokenList(4, setup.roles.root);

	setup.Lbp = balancer.Lbp(setup);

    setup.data = {};

    return setup;
}

describe("Contract: LBPWrapper", async () => {
    let setup;
    let swapEnabledOnStart;
	let now;
	let startTime;
	let endTime;
	let nonce;
    context("create LBPWrapper clone", async () => {
		// // Parameters to initialize LBPDeployer contract
		const NAME = "Test";
		const SYMBOL = "TT";
		now = new BN(Math.floor(Date.now()/1000));
		const SWAP_FEE_PERCENTAGE = parseEther('0.01').toString();
		const START_WEIGHTS = [
			parseEther('0.35').toString(), parseEther('0.65').toString()];
		const END_WEIGHTS = [
			parseEther('0.15').toString(), parseEther('0.85').toString()];
		const UPDATE_DURATION = await time.duration.minutes(60);
		let amounts = [parseEther('35').toString(), parseEther('65').toString()];
		startTime = await now.add(await time.duration.minutes(10));
		endTime = await startTime.add(UPDATE_DURATION);
		swapEnabledOnStart = true;
		nonce = 0;
		let initUserData;
        before("!! deploy WrapperFactory", async () => {
            setup = await deploy();
			tokenAddresses = [setup.tokenList[0].address, setup.tokenList[1].address];
            setup.wrapperFactory = await (await ethers.getContractFactory("WrapperFactory", setup.roles.root))
                .deploy(
                    setup.lbpFactory.address, SWAP_FEE_PERCENTAGE
                );
			setup.lbpWrapper = await (await ethers.getContractFactory("LBPWrapper", setup.roles.root)).deploy();
			await setup.wrapperFactory.setMasterCopy(setup.lbpWrapper.address);
			if(tokenAddresses[1]<tokenAddresses[0]){
				const tokenContract = setup.tokenList[0];
				setup.tokenList[0] = setup.tokenList[1];
				setup.tokenList[1] = tokenContract;
				const token = tokenAddresses[0];
				tokenAddresses[0] = tokenAddresses[1];
				tokenAddresses[1] = token;
				let weight = START_WEIGHTS[0];
				START_WEIGHTS[0] = START_WEIGHTS[1];
				START_WEIGHTS[1] = weight;
				weight = END_WEIGHTS[0];
				END_WEIGHTS[0] = END_WEIGHTS[1];
				END_WEIGHTS[1] = weight; 
				amount = amounts[0];
				amounts[0] = amounts[1];
				amounts[1] = amount;
			}
			await setup.tokenList[0].connect(setup.roles.root).approve(setup.wrapperFactory.address, amounts[0]);
			await setup.tokenList[1].connect(setup.roles.root).approve(setup.wrapperFactory.address, amounts[1]);
			initUserData =ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                        [0, amounts]);
            expect(await setup.wrapperFactory.isInitialized()).to.equal(true);
			expect(await setup.wrapperFactory.wrapperMasterCopy()).to.equal(setup.lbpWrapper.address);
        });
        it("creates lbp factory from wrapper", async () => {
            const receipt = await (await setup.wrapperFactory.connect(setup.roles.root).deployLBPUsingWrapper(
                NAME,
				SYMBOL,
				tokenAddresses,
				amounts,
				START_WEIGHTS,
				swapEnabledOnStart,
				startTime.toNumber(),
				endTime.toNumber(),
				END_WEIGHTS,
				setup.roles.root.address,
				initUserData
            )).wait();
			const {lbp, wrapper} = receipt.events.filter((data) => {return data.event === 'LBPDeployedUsingWrapper'})[0].args;
			setup.lbp = setup.Lbp.attach(lbp);
			setup.lbpWrapper = setup.lbpWrapper.attach(wrapper);
			expect(await setup.lbp.name()).to.equal(NAME);
			expect(await setup.lbp.getOwner()).to.equal(wrapper);
			expect(await setup.lbpWrapper.owner()).to.equal(setup.roles.root.address);
			expect(await setup.lbp.symbol()).to.equal(SYMBOL);
			const balances = (await setup.vault.getPoolTokens(setup.lbp.getPoolId())).balances;
			expect(balances[0].toString()).to.equal(amounts[0]);
			expect(balances[1].toString()).to.equal(amounts[1]);
        });
    });
});