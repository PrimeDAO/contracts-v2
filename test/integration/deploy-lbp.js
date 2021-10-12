// integration test for deploying LBP using LBPWrapper through Gnosis Safe

const init = require("../test-init");
const balancer = require("../helpers/balancer");
const tokens = require("../helpers/tokens");
const { parseUnits } = ethers.utils;

const { expect } = require("chai");
const { constants, BN } = require("@openzeppelin/test-helpers");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.gnosisSafe = await init.getContractInstance(
    "GnosisSafe",
    setup.roles.prime
  );

  setup.proxySafe = await init.getGnosisProxyInstance(setup);

  setup.vault = await balancer.getVaultInstance();

  setup.lbpFactory = await balancer.getLbpFactoryInstance(setup.vault);

  setup.Lbp = balancer.getLbpFactory(setup.roles.root);

  setup.wrapperFactory = await init.getContractInstance(
    "LBPManagerFactory",
    setup.roles.root,
    [setup.lbpFactory.address]
  );

  setup.lbpWrapper = await init.getContractInstance(
    "LBPManager",
    setup.roles.root
  );

  setup.tokenList = await tokens.getErc20TokenInstances(2, setup.roles.root);

  setup.signer = await init.signerV2(setup);

  await setup.wrapperFactory
    .connect(setup.roles.root)
    .setMasterCopy(setup.lbpWrapper.address);

  return setup;
};

function sortTokens(tokens) {
  if (tokens[0].address.toLowerCase() > tokens[1].address.toLowerCase()) {
    const temp = tokens[0];
    tokens[0] = tokens[1];
    tokens[1] = temp;
  }

  return tokens;
}

describe("Integration: Deploy LBP using Gnosis Safe", async () => {
  let setup;
  let tokenAddresses,
    admin,
    owner,
    sortedTokens,
    projectAdmin,
    primeBeneficiary;

  const startTime = Math.floor(Date.now() / 1000) + 1;
  const endTime = startTime + 100000;

  const NAME = "SEED-MKR POOL";
  const SYMBOL = "SEED-MKR";

  const START_WEIGHTS = [0.7e18, 0.3e18].map((weight) => weight.toString());
  const END_WEIGHTS = [0.3e18, 0.7e18].map((weight) => weight.toString());
  const ADMIN_BALANCE = [32.667e18, 30000e6].map((balance) =>
    balance.toString()
  );

  const AMOUNTS = [16.667e18, 15000e6].map((amount) => amount.toString());
  const SWAP_FEE_PERCENTAGE = (0.5e16).toString(); // 0.5%
  const FEE_FIVE = parseUnits("5", 17);
  const fees = [SWAP_FEE_PERCENTAGE, FEE_FIVE];
  const zero = 0;
  const magicValue = `0x20c13b0b`;
  const signaturePosition = 196;
  const METADATA = "0x";

  context("Deploying without signer", async () => {
    context(">> setup gnosis safe", async () => {
      before("!! setup", async () => {
        setup = await deploy();
        swapsEnabled = true;

        ({
          root: owner,
          prime: admin,
          beneficiary: newOwner,
          buyer1: projectAdmin,
          buyer2: primeBeneficiary,
        } = setup.roles);
        sortedTokens = sortTokens(setup.tokenList);
        // Need to solve this in tokens.js helper file for > 2 tokens.
        tokenAddresses = sortedTokens.map((token) => token.address);
      });
      it("$ setups gnosis safe", async () => {
        await setup.proxySafe
          .connect(owner)
          .setup(
            [owner.address],
            1,
            setup.proxySafe.address,
            "0x",
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS,
            0,
            admin.address
          );
        expect(await setup.proxySafe.isOwner(owner.address)).to.equal(true);
      });
    });
    context("$ deploy LBP", async () => {
      before("!! setup balance and arguments", async () => {
        params = [
          projectAdmin.address,
          primeBeneficiary.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          AMOUNTS,
          START_WEIGHTS,
          [startTime, endTime],
          END_WEIGHTS,
          fees,
          METADATA,
        ];

        await sortedTokens[0]
          .connect(owner)
          .transfer(admin.address, ADMIN_BALANCE[0]);
        await sortedTokens[1]
          .connect(owner)
          .transfer(admin.address, ADMIN_BALANCE[1]);

        await sortedTokens[0]
          .connect(admin)
          .approve(setup.wrapperFactory.address, ADMIN_BALANCE[0]);
        await sortedTokens[1]
          .connect(admin)
          .approve(setup.wrapperFactory.address, ADMIN_BALANCE[1]);
      });
      it("$ deploys LBP using Gnosis Safe", async () => {
        const { data, to } =
          await setup.wrapperFactory.populateTransaction.deployLBPManager(
            ...params
          );
        let gasEstimated =
          await setup.wrapperFactory.estimateGas.deployLBPManager(...params);
        await setup.wrapperFactory
          .connect(owner)
          .transferOwnership(setup.proxySafe.address);
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
        const hash = await setup.proxySafe.getTransactionHash(...trx, nonce);
        const signature = (await owner.signMessage(ethers.utils.arrayify(hash)))
          .replace(/1b$/, "1f")
          .replace(/1c$/, "20");
        trx.push(signature);
        await expect(
          setup.proxySafe.connect(owner).execTransaction(...trx)
        ).to.emit(setup.wrapperFactory, "LBPManagerDeployed");
      });
    });
  });
  context("Deploying using Signer", async () => {
    before("!! new setup", async () => {
      setup = await deploy();
      ({
        root: owner,
        prime: admin,
        beneficiary: newOwner,
        buyer1: projectAdmin,
        buyer2: primeBeneficiary,
      } = setup.roles);
      sortedTokens = sortTokens(setup.tokenList);
      // Need to solve this in tokens.js helper file for > 2 tokens.
      tokenAddresses = sortedTokens.map((token) => token.address);

      params = [
        projectAdmin.address,
        primeBeneficiary.address,
        NAME,
        SYMBOL,
        tokenAddresses,
        AMOUNTS,
        START_WEIGHTS,
        [startTime, endTime],
        END_WEIGHTS,
        fees,
        METADATA,
      ];
    });
    context(">> Setup Gnosis Safe", async () => {
      it("$ Success", async () => {
        await setup.proxySafe
          .connect(owner)
          .setup(
            [owner.address, setup.signer.address],
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
    context(">> Setup Signer", async () => {
      it("$ adds correct contract and function signatures", async () => {
        const contractAddress = setup.wrapperFactory.address;
        const functionSignature =
          await setup.wrapperFactory.interface.getSighash("deployLBPManager");
        const { data, to } =
          await setup.signer.populateTransaction.approveNewTransaction(
            contractAddress,
            functionSignature
          );
        let gasEstimated = await setup.signer.estimateGas.approveNewTransaction(
          contractAddress,
          functionSignature
        );
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
        const hash = await setup.proxySafe.getTransactionHash(...trx, nonce);
        const signature = (await owner.signMessage(ethers.utils.arrayify(hash)))
          .replace(/1b$/, "1f")
          .replace(/1c$/, "20");
        trx.push(signature);
        await setup.signer.connect(owner).setSafe(setup.proxySafe.address);
        await setup.proxySafe.connect(owner).execTransaction(...trx);
        expect(
          await setup.signer.allowedTransactions(
            contractAddress,
            functionSignature
          )
        ).to.equal(true);
      });
    });
    context(">> Generate Valid Signature from Signer", async () => {
      before("!! transfer correct balances", async () => {
        await sortedTokens[0]
          .connect(owner)
          .transfer(admin.address, ADMIN_BALANCE[0]);
        await sortedTokens[1]
          .connect(owner)
          .transfer(admin.address, ADMIN_BALANCE[1]);

        await sortedTokens[0]
          .connect(admin)
          .approve(setup.wrapperFactory.address, ADMIN_BALANCE[0]);
        await sortedTokens[1]
          .connect(admin)
          .approve(setup.wrapperFactory.address, ADMIN_BALANCE[1]);
      });
      it("success", async () => {
        const { data, to } =
          await setup.wrapperFactory.populateTransaction.deployLBPManager(
            ...params
          );
        let gasEstimated =
          await setup.wrapperFactory.estimateGas.deployLBPManager(...params);
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
        await setup.wrapperFactory
          .connect(owner)
          .transferOwnership(setup.proxySafe.address);
        const nonce = await setup.proxySafe.nonce();
        const transaction = await setup.signer.generateSignature(...trx, nonce);
        const receipt = await transaction.wait();
        const { signature, hash } = receipt.events.filter((data) => {
          return data.event === "SignatureCreated";
        })[0].args;
        trx.push(signature);
        setup.trx = trx;
        expect(
          await setup.signer.isValidSignature(
            hash,
            `0x${signature.slice(signaturePosition)}`
          )
        ).to.equal(magicValue);
      });
    });
    context(">> Deploy LBP using Signer signature", async () => {
      it("success", async () => {
        await expect(setup.proxySafe.execTransaction(...setup.trx)).to.emit(
          setup.wrapperFactory,
          "LBPManagerDeployed"
        );
      });
    });
  });
});
