// integration test for deploying LBP using LBPWrapper through Gnosis Safe

const init = require("../test-init");
const balancer = require("../helpers/balancer");
const tokens = require("../helpers/tokens");

const { expect } = require("chai");
const { parseEther } = ethers.utils;
const {constants, BN} = require('@openzeppelin/test-helpers');

const SWAP_FEE_PERCENTAGE = (0.5e16).toString(); // 0.5%

const deploy = async () => {
    const setup = await init.initialize(await ethers.getSigners());

    setup.gnosisSafe = await init.gnosisSafe(setup);

    setup.proxySafe = await init.gnosisProxy(setup);

    setup.vault = await balancer.Vault(setup);

    setup.lbpFactory = await balancer.LBPFactory(setup);

    setup.Lbp = balancer.Lbp(setup);

    setup.wrapperFactory = await init.getDeployedContract("WrapperFactory", setup.roles.root, [
        setup.lbpFactory.address,
        SWAP_FEE_PERCENTAGE,
    ]);

    setup.lbpWrapper = await init.getDeployedContract("LBPWrapper", setup.roles.root);

    setup.tokenList = await tokens.ERC20TokenList(2, setup.roles.root);

    await setup.wrapperFactory.connect(setup.roles.root).setMasterCopy(setup.lbpWrapper.address);

    return setup;
};

function sortTokens(tokens) {
	if (tokens[0].address > tokens[1].address) {
		const temp = tokens[0];
		tokens[0] = tokens[1];
		tokens[1] = temp;
	};

	return tokens;
};

describe("Integration: Deploy LBP using Gnosis Safe", async () => {
    let setup;
    let tokenAddresses, admin, owner, sortedTokens, newOwner;

    const startTime = Date.now();
    const endTime = startTime + 100000;

    const NAME = "SEED-MKR POOL";
    const SYMBOL = "SEED-MKR";

    const START_WEIGHTS = [0.7e18, 0.3e18].map((weight) => weight.toString());
    const END_WEIGHTS = [0.3e18, 0.7e18].map((weight) => weight.toString());
    const ADMIN_BALANCE = [32.667e18, 30000e6].map((balance) => balance.toString());

    const AMOUNTS = [16.667e18, 15000e6].map((amount) => amount.toString());
    const SWAP_FEE_PERCENTAGE = (0.5e16).toString(); // 0.5%
    const JOIN_KIND_INIT = 0;
    const zero = 0;

    context(">> setup gnosis safe", async () => {
        before("!! setup", async () => {
            setup = await deploy();
            swapsEnabled = true;

			({ root: owner, prime: admin,  beneficiary: newOwner} = setup.roles);
			sortedTokens = sortTokens(setup.tokenList);
			// Need to solve this in tokens.js helper file for > 2 tokens.
			tokenAddresses = sortedTokens.map((token) => token.address);
        });
        it("$ setups gnosis safe", async () => {
            await setup.proxySafe.connect(owner).setup(
                [owner.address],
                1,
                setup.proxySafe.address,
                "0x",
                constants.ZERO_ADDRESS,
                constants.ZERO_ADDRESS,
                0,
                admin.address
            );
        });
    });
    context("$ deploy LBP", async () => {
        before("!! setup balance and arguments", async () => {
            userData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
				[JOIN_KIND_INIT, AMOUNTS]);
            params = [
                NAME,
                SYMBOL,
                tokenAddresses,
                AMOUNTS,
                START_WEIGHTS,
                swapsEnabled,
                startTime,
                endTime,
                END_WEIGHTS,
                admin.address,
                userData
            ];

            await sortedTokens[0].connect(owner).transfer(admin.address, ADMIN_BALANCE[0]);
			await sortedTokens[1].connect(owner).transfer(admin.address, ADMIN_BALANCE[1]);

			await sortedTokens[0].connect(admin).approve(setup.wrapperFactory.address, ADMIN_BALANCE[0]);
			await sortedTokens[1].connect(admin).approve(setup.wrapperFactory.address, ADMIN_BALANCE[1]);
        });
        it("$ deploys LBP using Gnosis Safe", async () => {
            const {data, to} = await setup.wrapperFactory.populateTransaction.deployLBPUsingWrapper(
                ...params
            );
            let gasEstimated = await setup.wrapperFactory.estimateGas.deployLBPUsingWrapper(
                ...params
            );
            await setup.wrapperFactory.connect(owner).transferOwnership(setup.proxySafe.address);
            const trx = [
                to,
                zero,
                data,
                zero,
                gasEstimated,
                gasEstimated,
                zero,
                constants.ZERO_ADDRESS,
                constants.ZERO_ADDRESS,
              ];
            const nonce = await setup.proxySafe.nonce();
            const hash = await setup.proxySafe.getTransactionHash(
                ...trx,
                nonce
            );
            const signature = (await owner.signMessage(ethers.utils.arrayify(hash))).slice(0,-1)+'f';
            trx.push(signature);
            await expect(
                setup.proxySafe.connect(owner).execTransaction(...trx)
            ).to.emit(setup.wrapperFactory, "LBPDeployedUsingWrapper");
        });
    });
});