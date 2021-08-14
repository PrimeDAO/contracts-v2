const {expect} = require('chai');
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const init = require("../test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const {constants, BN} = require('@openzeppelin/test-helpers');

const deploy = async () => {
	const setup = await init.initialize(await ethers.getSigners());
	
	setup.vault = await balancer.Vault(setup);
	
	setup.lbpFactory = await balancer.LBPFactory(setup);
	
	setup.Lbp = balancer.Lbp(setup);

    setup.LBPWrapper = await init.LBPWrapper(setup);

	setup.tokenList = await tokens.ERC20TokenList(2, setup.roles.root);

	return setup
}

function sortTokens(tokens) {
	if (tokens[0].address > tokens[1].address) {
		const temp = tokens[0];
		tokens[0] = tokens[1];
		tokens[1] = temp;
	};

	return tokens;
};

describe("Contract: LBPWrapper", async () => {
	let setup;
	let swapsEnabled;
	let tokenAddresses;
    let sortedTokens;
	const NAME = "Test";
	const SYMBOL = "TT";
	let startTime = Date.now();
	let endTime = startTime+100000;
	let WEIGHTS = [parseEther('0.6').toString(), parseEther('0.4')];
	const END_WEIGHTS = [parseEther('0.4').toString(), parseEther('0.6')];
	const POOL_SWAP_FEE_PERCENTAGE = parseEther('0.01').toString();
    const NEW_SWAP_FEE_PERCENTAGE = parseEther('0.02').toString();
    let initUserData;

    context(">> deploy LBP Wrapper", async () => {
        before("!! setup", async () => {
            setup = await deploy();
            swapsEnabled = true;
            
            sortedTokens = sortTokens(setup.tokenList);
            tokenAddresses = sortedTokens.map((token) => token.address);
        });
        it("$ deploy LBPWrapper", async () => {
            setup.lbpWrapper = await setup.LBPWrapper.deploy();
        });
    });
    context(">> initialize LBPWrapper", async () => {
        it("success", async () => {
            await setup.lbpWrapper.connect(setup.roles.root).initialize(setup.lbpFactory.address, POOL_SWAP_FEE_PERCENTAGE);
            expect(await setup.lbpWrapper.LBPFactory()).to.equal(setup.lbpFactory.address);
        })
    });
    context(">> deploy LBP using Wrapper", async () => {
        before("!! transfer balances", async () => {
            await setup.tokenList[0].connect(setup.roles.root).transfer(setup.roles.prime.address, WEIGHTS[0]);
            await setup.tokenList[1].connect(setup.roles.root).transfer(setup.roles.prime.address, WEIGHTS[1]);

            await setup.tokenList[0].connect(setup.roles.prime).transfer(setup.lbpWrapper.address, WEIGHTS[0]);
            await setup.tokenList[1].connect(setup.roles.prime).transfer(setup.lbpWrapper.address, WEIGHTS[1]);

            initUserData =ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                        [0, WEIGHTS]);
        });
        it("$ reverts when called by non-owner", async () => {
            await expect(
                setup.lbpWrapper.connect(setup.roles.prime).deployLbpFromFactory(
                    NAME,
                    SYMBOL,
                    tokenAddresses,
                    WEIGHTS,
                    WEIGHTS,
                    swapsEnabled,
                    startTime,
                    endTime,
                    END_WEIGHTS,
                    setup.roles.prime.address,
                    initUserData
                )
            ).to.be.revertedWith("LBPWrapper: only owner function");
        });
        it("$ success", async () => {
            await setup.lbpWrapper.connect(setup.roles.root).deployLbpFromFactory(
                NAME,
                SYMBOL,
                tokenAddresses,
                WEIGHTS,
                WEIGHTS,
                swapsEnabled,
                startTime,
                endTime,
                END_WEIGHTS,
                setup.roles.prime.address,
                initUserData
            );
            expect(await setup.lbpWrapper.lbp()).not.equal(constants.ZERO_ADDRESS);
        });
    });
    context(">> transfers ownership to admin", async () => {
        it("$ reverts when new owner address is zero", async () => {
            await expect(
                setup.lbpWrapper.connect(setup.roles.root).transferOwnership(constants.ZERO_ADDRESS)
            ).to.be.revertedWith("LBPWrapper: new owner cannot be zero");
        })
        it("$ success", async () => {
            await setup.lbpWrapper.connect(setup.roles.root).transferOwnership(setup.roles.prime.address);
            expect(await setup.lbpWrapper.owner()).to.equal(setup.roles.prime.address);
        })
    });
    context(">> set swap fee percentage", async () => {
        it("$ reverts when sender is not owner",async () => {
            await expect(
                setup.lbpWrapper.connect(setup.roles.root).setSwapFeePercentage(NEW_SWAP_FEE_PERCENTAGE)
            ).to.be.revertedWith("LBPWrapper: only owner function");
        });
        it("$ sets new swap fee",async () => {
            await setup.lbpWrapper.connect(setup.roles.prime).setSwapFeePercentage(NEW_SWAP_FEE_PERCENTAGE);
            expect((await setup.lbpWrapper.swapFeePercentage()).toString()).to.equal(NEW_SWAP_FEE_PERCENTAGE);
        });
    });

});