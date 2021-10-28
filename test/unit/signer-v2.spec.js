const { expect } = require("chai");
const { constants, time } = require("@openzeppelin/test-helpers");
const init = require("../test-init.js");
const balancer = require("../helpers/balancer");
const tokens = require("../helpers/tokens");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { parseEther, parseUnits } = ethers.utils;

// constants
const zero = 0;
const gasAmount = 555162;
const magicValue = `0x20c13b0b`;
const signaturePosition = 196;
const SIGNATURE_CREATED = "SignatureCreated";

const NAME = "Signer LBP";
const SYMBOL = "SLBP";
const INITIAL_BALANCES = [parseUnits("2000", 18), parseUnits("1000", 18)];
const START_WEIGHTS = [parseEther("0.6"), parseEther("0.4")];
const END_WEIGHTS = [parseEther("0.4"), parseEther("0.6")];
const fees = [parseUnits("1", 16), 0];
const METADATA = "0x";

const getCurrentTime = async () => {
  return parseInt((await time.latest()).toString());
};

const getParameters = async (
  lbpFactoryAddress,
  tokenAddresses,
  beneficiary
) => {
  const startTime = await getCurrentTime();
  const endTime = startTime + 1000;
  const startTimeEndTime = [startTime, endTime];
  return [
    lbpFactoryAddress,
    beneficiary,
    NAME,
    SYMBOL,
    tokenAddresses,
    INITIAL_BALANCES,
    START_WEIGHTS,
    startTimeEndTime,
    END_WEIGHTS,
    fees,
    METADATA,
  ];
};

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

  setup.lbpManagerFactoryInstance = await init.getContractInstance(
    "LBPManagerFactory",
    setup.roles.root,
    [setup.lbpFactory.address]
  );

  setup.lbpManagerInstance = await init.getContractInstance(
    "LBPManager",
    setup.roles.root
  );

  setup.tokenList = await tokens.getErc20TokenInstances(2, setup.roles.root);

  await setup.lbpManagerFactoryInstance
    .connect(setup.roles.root)
    .setMasterCopy(setup.lbpManagerInstance.address);

  setup.data = {};

  return setup;
};

describe("Contract: Signer", async () => {
  let setup;
  let nonce = 0;
  let Signer_Factory;
  let ZERO_BYTES4 = "0x00000000";
  let tokenAddresses,
    admin,
    owner,
    sortedTokens,
    newOwner,
    projectAdmin,
    primeBeneficiary,
    uselessFunctionSignature,
    deployLBPManagerFunctionSignature;
  before("!! setup", async () => {
    setup = await deploy();
    Signer_Factory = await ethers.getContractFactory(
      "SignerV2",
      setup.roles.root
    );
    tokenAddresses = setup.tokenList.map((signer) => signer.address);
    ({
      root: owner,
      prime: admin,
      beneficiary: newOwner,
      buyer1: projectAdmin,
      buyer2: primeBeneficiary,
    } = setup.roles);
    uselessFunctionSignature =
      await setup.lbpManagerFactoryInstance.interface.getSighash(
        "setMasterCopy"
      );
    deployLBPManagerFunctionSignature =
      await setup.lbpManagerFactoryInstance.interface.getSighash(
        "deployLBPManager"
      );
  });
  context(">> deploy signer contract", async () => {
    context("invalid constructor parameters", async () => {
      it("reverts when safe address is zero", async () => {
        await expect(
          Signer_Factory.deploy(constants.ZERO_ADDRESS, [], [])
        ).to.revertedWith("Signer: Safe address zero");
      });
      it("reverts when contract address is zero or function signature is zero", async () => {
        await expect(
          Signer_Factory.deploy(
            setup.proxySafe.address,
            [constants.ZERO_ADDRESS],
            [ZERO_BYTES4]
          )
        ).to.revertedWith("Signer: contract address zero");
        await expect(
          Signer_Factory.deploy(
            setup.proxySafe.address,
            [setup.lbpManagerFactoryInstance.address],
            [ZERO_BYTES4]
          )
        ).to.revertedWith("Signer: function signature zero");
      });
    });
    context("valid constructor parameters", async () => {
      it("deploys signer contract", async () => {
        setup.signer = await Signer_Factory.deploy(
          setup.proxySafe.address,
          [setup.lbpManagerFactoryInstance.address],
          [uselessFunctionSignature]
        );
        expect(await setup.signer.connect(setup.roles.root).safe()).to.equal(
          setup.proxySafe.address
        );
      });
    });
  });
  context(">> approveNewTransaction", async () => {
    beforeEach("!! new Signer v2 instance", async () => {
      setup.newSigner = await Signer_Factory.deploy(owner.address, [], []);
    });
    it("$ reverts when caller is not safe", async () => {
      await expect(
        setup.newSigner
          .connect(admin)
          .approveNewTransaction(
            setup.lbpManagerFactoryInstance.address,
            uselessFunctionSignature
          )
      ).to.be.revertedWith("Signer: only safe functionality");
    });
    it("$ reverts when contract address is zero address", async () => {
      await expect(
        setup.newSigner
          .connect(owner)
          .approveNewTransaction(ZERO_ADDRESS, uselessFunctionSignature)
      ).to.be.revertedWith("Signer: contract address zero");
    });
    it("$ reverts when function signature is zero", async () => {
      await expect(
        setup.newSigner
          .connect(owner)
          .approveNewTransaction(
            setup.lbpManagerFactoryInstance.address,
            "0x00000000"
          )
      ).to.be.revertedWith("Signer: function signature zero");
    });
    it("$ approves new transaction when invoked by safe", async () => {
      await expect(
        setup.newSigner
          .connect(owner)
          .approveNewTransaction(
            setup.lbpManagerFactoryInstance.address,
            uselessFunctionSignature
          )
      ).to.not.be.reverted;
      expect(
        await setup.newSigner
          .connect(owner)
          .allowedTransactions(
            setup.lbpManagerFactoryInstance.address,
            uselessFunctionSignature
          )
      ).to.equal(true);
    });
  });
  context(">> removeAllowedTransaction", () => {
    it("$ removes allowed transaction successfully", async () => {
      expect(
        await setup.newSigner
          .connect(owner)
          .allowedTransactions(
            setup.lbpManagerFactoryInstance.address,
            uselessFunctionSignature
          )
      ).to.equal(true);
      await expect(
        setup.newSigner
          .connect(owner)
          .removeAllowedTransaction(
            setup.lbpManagerFactoryInstance.address,
            uselessFunctionSignature
          )
      ).to.not.be.reverted;
      expect(
        await setup.newSigner
          .connect(owner)
          .allowedTransactions(
            setup.lbpManagerFactoryInstance.address,
            uselessFunctionSignature
          )
      ).to.equal(false);
    });
    it("$ reverts when trying to removed non existing transaction", async () => {
      await expect(
        setup.newSigner
          .connect(owner)
          .removeAllowedTransaction(
            setup.lbpManagerFactoryInstance.address,
            uselessFunctionSignature
          )
      ).to.be.revertedWith("Signer: only approved transactions can be removed");
    });
  });
  context(">> setSafe", async () => {
    beforeEach("!! new Signer v2 instance", async () => {
      setup.newSigner = await Signer_Factory.deploy(owner.address, [], []);
    });
    it("$ reverts when safe address is zero", async () => {
      await expect(
        setup.newSigner.connect(owner).setSafe(ZERO_ADDRESS)
      ).to.be.revertedWith("Signer: Safe zero address");
    });
    it("$ sets new safe safe address with valid address", async () => {
      await expect(
        setup.newSigner.connect(owner).setSafe(setup.proxySafe.address)
      ).to.not.be.reverted;
      expect(await setup.newSigner.connect(owner).safe()).to.equal(
        setup.proxySafe.address
      );
    });
  });
  context(">> generateSignature", async () => {
    before("!! setup with necessary function approved", async () => {
      setup.signer = await await Signer_Factory.deploy(
        setup.proxySafe.address,
        [setup.lbpManagerFactoryInstance.address],
        [deployLBPManagerFunctionSignature]
      );
      expect(
        await setup.signer
          .connect(owner)
          .allowedTransactions(
            setup.lbpManagerFactoryInstance.address,
            deployLBPManagerFunctionSignature
          )
      ).to.equal(true);
    });
    context("invalid arguments", async () => {
      it("reverts on invalid function call which is not approved", async () => {
        // here we create a transaction object
        nonce++;
        const { data, to } =
          await setup.lbpManagerFactoryInstance.populateTransaction.deployLBPManager(
            ...(await getParameters(
              setup.lbpFactory.address,
              tokenAddresses,
              primeBeneficiary.address
            ))
          );
        // incorrect factory address
        const trx = [
          primeBeneficiary.address,
          zero,
          data,
          zero,
          gasAmount,
          gasAmount,
          zero,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
        ];
        await expect(
          setup.signer.generateSignature(...trx, nonce)
        ).to.be.revertedWith("Signer: invalid function");
      });
      it("reverts on invalid value parameter", async () => {
        // here we create a transaction object
        nonce++;
        const { data, to } =
          await setup.lbpManagerFactoryInstance.populateTransaction.deployLBPManager(
            ...(await getParameters(
              setup.lbpFactory.address,
              tokenAddresses,
              primeBeneficiary.address
            ))
          );
        // incorrect seedFactory address
        const trx = [
          to,
          10,
          data,
          zero,
          gasAmount,
          gasAmount,
          zero,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
        ];
        await expect(
          setup.signer.generateSignature(...trx, nonce)
        ).to.be.revertedWith("Signer: invalid arguments");
      });
      it("reverts on invalid operation field", async () => {
        // here we create a transaction object
        nonce++;
        const { data, to } =
          await setup.lbpManagerFactoryInstance.populateTransaction.deployLBPManager(
            ...(await getParameters(
              setup.lbpFactory.address,
              tokenAddresses,
              primeBeneficiary.address
            ))
          );
        // incorrect seedFactory address
        const trx = [
          to,
          zero,
          data,
          1,
          gasAmount,
          gasAmount,
          zero,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
        ];
        await expect(
          setup.signer.generateSignature(...trx, nonce)
        ).to.be.revertedWith("Signer: invalid arguments");
      });
      it("reverts on invalid to refund receiver", async () => {
        // here we create a transaction object
        nonce++;
        const { data, to } =
          await setup.lbpManagerFactoryInstance.populateTransaction.deployLBPManager(
            ...(await getParameters(
              setup.lbpFactory.address,
              tokenAddresses,
              primeBeneficiary.address
            ))
          );
        // incorrect seedFactory address
        const trx = [
          to,
          zero,
          data,
          0,
          gasAmount,
          gasAmount,
          zero,
          constants.ZERO_ADDRESS,
          primeBeneficiary.address,
        ];
        await expect(
          setup.signer.generateSignature(...trx, nonce)
        ).to.be.revertedWith("Signer: invalid arguments");
      });
    });
    context("valid arguments", async () => {
      it("produces valid signature", async () => {
        const { data, to } =
          await setup.lbpManagerFactoryInstance.populateTransaction.deployLBPManager(
            ...(await getParameters(
              setup.lbpFactory.address,
              tokenAddresses,
              primeBeneficiary.address
            ))
          );
        const trx = [
          to,
          zero,
          data,
          zero,
          gasAmount,
          gasAmount,
          zero,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
        ];
        // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
        // and verify if the transaction is valid or not, and sign the hash.
        const transaction = await setup.signer.generateSignature(...trx, nonce);
        const hashData = await setup.proxySafe.encodeTransactionData(
          ...trx,
          nonce
        );
        nonce++;
        const receipt = await transaction.wait();
        const { signature, hash } = receipt.events.filter((data) => {
          return data.event === SIGNATURE_CREATED;
        })[0].args;
        trx.push(signature);
        setup.data.trx = trx;
        setup.data.hash = hash;
        setup.data.hashData = hashData;
        setup.data.deployLBPManagerData = { data, to };
        // checking if the signature produced can correctly be verified by signer contract.
        expect(
          await setup.signer.isValidSignature(
            hash,
            `0x${signature.slice(signaturePosition)}`
          )
        ).to.equal(magicValue);
        expect(
          await setup.signer.isValidSignature(
            hashData,
            `0x${signature.slice(signaturePosition)}`
          )
        ).to.equal(magicValue);
      });
    });
    context("transaction already signed", async () => {
      it("reverts", async () => {
        const { data, to } = setup.data.deployLBPManagerData;
        const trx = [
          to,
          zero,
          data,
          zero,
          gasAmount,
          gasAmount,
          zero,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS,
        ];
        // once transaction object is created, we send the transaction data along with nonce to generate safeTrx hash
        // and verify if the transaction is valid or not, and sign the hash.
        await expect(
          setup.signer.generateSignature(...trx, nonce - 1)
        ).to.revertedWith("Signer: transaction already signed");
      });
    });
  });
  context(">> isValidSignature", async () => {
    context("signature is invalid", async () => {
      it("doesn't returns magic value", async () => {
        expect(
          await setup.signer.isValidSignature(
            setup.data.hash,
            setup.data.hashData
          )
        ).to.equal("0x30780000");
        expect(
          await setup.signer.isValidSignature(
            setup.data.hashData,
            setup.data.hashData
          )
        ).to.equal("0x30780000");
      });
    });
  });
  context(">> check if signature is accepted by gnosis safe", async () => {
    before("!! new setup", async () => {
      setup = await deploy();
      Signer_Factory.connect(setup.roles.root);
      setup.signer = await Signer_Factory.deploy(
        setup.proxySafe.address,
        [setup.lbpManagerFactoryInstance.address],
        [deployLBPManagerFunctionSignature]
      );
      await setup.proxySafe.setup(
        [setup.signer.address, setup.roles.prime.address],
        1,
        setup.proxySafe.address,
        "0x",
        constants.ZERO_ADDRESS,
        constants.ZERO_ADDRESS,
        0,
        setup.roles.prime.address
      );
    });
    it("Signer contract is safe owner", async () => {
      expect(await setup.proxySafe.isOwner(setup.signer.address)).to.equal(
        true
      );
    });
    it("safe should accept signer's signature", async () => {
      const { data, to } = await setup.lbpManagerFactoryInstance
        .connect(owner)
        .populateTransaction.deployLBPManager(
          ...(await getParameters(
            setup.lbpFactory.address,
            tokenAddresses,
            primeBeneficiary.address
          ))
        );
      let gasEstimated = await setup.lbpManagerFactoryInstance
        .connect(owner)
        .estimateGas.deployLBPManager(
          ...(await getParameters(
            setup.lbpFactory.address,
            tokenAddresses,
            primeBeneficiary.address
          ))
        );
      // transafer seedFactory ownership to safe
      await setup.lbpManagerFactoryInstance
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
      const transaction = await setup.signer.generateSignature(...trx, nonce);
      const receipt = await transaction.wait();
      const { signature, hash } = receipt.events.filter((data) => {
        return data.event === SIGNATURE_CREATED;
      })[0].args;
      trx.push(signature);
      setup.data.trx = trx;
      setup.data.hash = hash;
      await expect(
        setup.proxySafe
          .connect(setup.roles.prime)
          .execTransaction(...setup.data.trx)
      ).to.emit(setup.lbpManagerFactoryInstance, "LBPManagerDeployed");
    });
  });
});
