const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");
const { parseEther, parseUnits } = ethers.utils;

const init = require("../test-init.js");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const { constants } = require("@openzeppelin/test-helpers");
const VaultArtifact = require("../../imports/Vault.json");
const { formatUnits, big } = require("@ethersproject/units");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { zeroPad } = require("@ethersproject/bytes");

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    const { deploy } = deployments;
    const { root } = await ethers.getNamedSigners();

    const vaultInstance = await balancer.getVaultInstance();
    const lbpFactoryInstance = await balancer.getLbpFactoryInstance(
      vaultInstance
    );

    await deploy("LbpWrapper", {
      contract: "LBPWrapper",
      from: root.address,
      log: true,
    });

    const contractInstances = {
      lbpFactoryInstance: lbpFactoryInstance,
      lbpContractFactory: await balancer.getLbpFactory(root),
      lbpWrapperInstance: await ethers.getContract("LbpWrapper"),
      tokenInstances: await tokens.getErc20TokenInstances(2, root),
    };

    return { ...contractInstances };
  }
);

const paramGenerator = {};
paramGenerator.initializeParams = (
  factory,
  name,
  symbol,
  tokens,
  amounts,
  startWeights,
  startTime,
  endTime,
  endWeights,
  swapFee,
  primeFee,
  beneficiary) => ([
    factory,
    beneficiary,
    name,
    symbol,
    tokens,
    amounts,
    startWeights,
    [startTime, endTime],
    endWeights,
    swapFee,
    primeFee,
  ]);

const setupInitialState = async (contractInstances, initialState) => {
  const HUNDRED_PERCENT = parseUnits("10", 18);

  const signers = await ethers.getSigners();
  [owner, admin, beneficiary] = signers;
  // }

  const {
    lbpFactoryInstance,
    lbpContractFactory,
    lbpWrapperInstance,
    tokenInstances,
  } = contractInstances;

  const tokenAddresses = tokenInstances.map((token) => token.address);

  const { initializeLBPParams, OwnerAdmin, funds, userData } = initialState;

  if (initializeLBPParams) {
    if (OwnerAdmin) {
      await lbpWrapperInstance
        .connect(admin)
        .initializeLBP(...initializeLBPParams);
    } else {
      await lbpWrapperInstance
        .connect(owner)
        .initializeLBP(...initializeLBPParams);
    }
  }

  if (funds) {
    const { initialBalances, primeDaoFeePercentage } = funds;
    await tokenInstances[0]
      .connect(owner)
      .transfer(admin.address, initialBalances[0].mul(2).toString());
    await tokenInstances[1]
      .connect(owner)
      .transfer(admin.address, initialBalances[1].mul(2).toString());

    // Add fee amount on top
    const amountToAddForFee = initialBalances[0]
      .mul(primeDaoFeePercentage)
      .div(HUNDRED_PERCENT);
    initialBalances[0] = initialBalances[0].add(amountToAddForFee);

    await tokenInstances[0]
      .connect(admin)
      .approve(lbpWrapperInstance.address, initialBalances[0].toString());
    await tokenInstances[1]
      .connect(admin)
      .approve(lbpWrapperInstance.address, initialBalances[1].toString());

    if (userData) {
      await lbpWrapperInstance.connect(admin).fundPool(
        tokenAddresses,
        admin.address,
        false, // fromInternalBalance
        userData
      );
    }
  }

  return { lbpWrapperInstance, tokenInstances };
};

describe(">> Contract: LBPWrapper", () => {
  let setup;
  const NAME = "Test";
  const SYMBOL = "TT";
  let startTime = Date.now();
  let endTime = startTime + 100000;
  const amounts = [1e18, 10e18].map((amount) => amount.toString());
  let WEIGHTS = [parseEther("0.6").toString(), parseEther("0.4")];
  const HUNDRED_PERCENT = parseUnits("10", 18);
  // const FIVE_PERCENT = parseUnits("10", 16).mul(5);
  const INITIAL_BALANCES = [parseUnits("2000", 18), parseUnits("1000", 18)];
  const END_WEIGHTS = [parseEther("0.4").toString(), parseEther("0.6")];
  const SWAP_FEE_PERCENTAGE = parseUnits("1", 16);
  const TO_LOW_SWAP_FEE_PERCENTAGE = parseUnits("1", 10);
  const TO_HIGH_SWAP_FEE_PERCENTAGE = parseUnits("1", 18);
  const JOIN_KIND_INIT = 0;
  const PRIME_DAO_FEE_PERCENTAGE = parseUnits("5", 17);
  const FROM_INTERNAL_BALANCE = false;

  let poolId,
    admin,
    owner,
    beneficiary,
    initializeLBPParams,
    amountToAddForFee,
    lbpFactoryInstance,
    contractInstances,
    lbpWrapperInstance,
    tokenInstances,
    lbpContractFactory,
    lbpInstance,
    tokenAddresses;

  before(async () => {
    const signers = await ethers.getSigners();
    [owner, admin, beneficiary, receiver] = signers;
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({
      lbpFactoryInstance,
      lbpContractFactory,
      lbpWrapperInstance,
      tokenInstances,
    } = contractInstances);

    tokenAddresses = tokenInstances.map((token) => token.address);

    initializeLBPParams = paramGenerator.initializeParams(
      lbpFactoryInstance.address,
      NAME,
      SYMBOL,
      tokenAddresses,
      amounts,
      WEIGHTS,
      startTime,
      endTime,
      END_WEIGHTS,
      SWAP_FEE_PERCENTAGE,
      PRIME_DAO_FEE_PERCENTAGE,
      beneficiary.address,
    );
  });

  describe("# deploy LBP using Wrapper", () => {
    describe("$ deploy LBP using Wrapper fails", () => {
      let invalidInitializeLBPParams;

      it("» revert on swap fee to high", async () => {
        invalidInitializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          amounts,
          WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          TO_HIGH_SWAP_FEE_PERCENTAGE,
          PRIME_DAO_FEE_PERCENTAGE,
          beneficiary.address,
        );
        await expect(
          lbpWrapperInstance
            .connect(owner)
            .initializeLBP(...invalidInitializeLBPParams)
        ).to.be.revertedWith(
          "BAL#202" //MAX_SWAP_FEE_PERCENTAGE
        );
      });
      it("» revert on swap fee to low", async () => {
        invalidInitializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          amounts,
          WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          TO_LOW_SWAP_FEE_PERCENTAGE,
          PRIME_DAO_FEE_PERCENTAGE,
          beneficiary.address,
        );
        await expect(
          lbpWrapperInstance
            .connect(owner)
            .initializeLBP(...invalidInitializeLBPParams)
        ).to.be.revertedWith(
          "BAL#203" //MIN_SWAP_FEE_PERCENTAGE
        );
      });
      it("» revert on beneficiary address being zero", async () => {
        invalidInitializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          amounts,
          WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          SWAP_FEE_PERCENTAGE,
          PRIME_DAO_FEE_PERCENTAGE,
          ZERO_ADDRESS,
        );
        await expect(
          lbpWrapperInstance
            .connect(owner)
            .initializeLBP(...invalidInitializeLBPParams)
        ).to.be.revertedWith("LBPWrapper: _beneficiary cannot be zero address");
      });
    });
    describe("$ deploy LBP using Wrapper succeeds", () => {
      it("» success", async () => {
        await lbpWrapperInstance
          .connect(owner)
          .initializeLBP(...initializeLBPParams);
        lbpInstance = lbpContractFactory.attach(await lbpWrapperInstance.lbp());
        poolId = await lbpInstance.getPoolId();

        expect(await lbpWrapperInstance.lbp()).not.equal(ZERO_ADDRESS);
        expect(await lbpWrapperInstance.beneficiary()).to.equal(
          beneficiary.address
        );
        expect(await lbpWrapperInstance.primeDaoFeePercentage()).to.equal(
          PRIME_DAO_FEE_PERCENTAGE
        );
      });
      it("» reverts when invoking it again", async () => {
        await lbpWrapperInstance
          .connect(owner)
          .initializeLBP(...initializeLBPParams);
        await expect(
          lbpWrapperInstance
            .connect(admin)
            .initializeLBP(...initializeLBPParams)
        ).to.be.revertedWith("LBPWrapper: already initialized");
      });
    });
  });
  describe("# transfers ownership of LBPWrapper", async () => {
    beforeEach(async () => {
      const initialState = {
        initializeLBPParams,
      };

      ({ lbpWrapperInstance } = await setupInitialState(
        contractInstances,
        initialState
      ));
    });
    it("» reverts when new owner address is zero", async () => {
      await expect(
        lbpWrapperInstance
          .connect(owner)
          .transferAdminRights(constants.ZERO_ADDRESS)
      ).to.be.revertedWith("LBPWrapper: new admin cannot be zero");
    });
    it("» success", async () => {
      await lbpWrapperInstance
        .connect(owner)
        .transferAdminRights(admin.address);
      expect(await lbpWrapperInstance.admin()).to.equal(admin.address);
    });
  });
  describe("# retrieve tokens through retrieveProjectAndFundingToken", () => {
    describe("$ retrieves tokens before call to fundPool()", () => {
      beforeEach(async () => {
        const funds = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE,
        };
        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          funds,
        };
        ({ lbpWrapperInstance, tokenInstances } = await setupInitialState(
          contractInstances,
          initialState
        ));
      });
      it("» reverts when not called by admin", async () => {
        await expect(
          lbpWrapperInstance.retrieveProjectAndFundingToken(receiver.address)
        ).to.be.revertedWith("LBPWrapper: only admin function");
      });
      it("» reverts when receiver address is zero", async () => {
        await expect(
          lbpWrapperInstance
            .connect(admin)
            .retrieveProjectAndFundingToken(ZERO_ADDRESS)
        ).to.be.revertedWith(
          "LBPWrapper: receiver of project and funding tokens can't be zero"
        );
      });
      it("» retrieves back the funds to admin", async () => {
        expect(
          await tokenInstances[0].balanceOf(lbpWrapperInstance.address)
        ).to.equal(INITIAL_BALANCES[0]);
        expect(
          await tokenInstances[1].balanceOf(lbpWrapperInstance.address)
        ).to.equal(INITIAL_BALANCES[1]);
        await lbpWrapperInstance
          .connect(admin)
          .retrieveProjectAndFundingToken(receiver.address);
        expect(await tokenInstances[0].balanceOf(receiver.address)).to.equal(
          INITIAL_BALANCES[0]
        );
        expect(await tokenInstances[1].balanceOf(receiver.address)).to.equal(
          INITIAL_BALANCES[1]
        );
      });
    });
    describe("$ try retrieve funds after call fundPool", () => {
      let userData;
      beforeEach(async () => {
        userData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256[]"],
          [JOIN_KIND_INIT, INITIAL_BALANCES]
        );
        // Specifies funds and fee to be sent to setpInitialState
        const funds = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE,
        };
        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          funds,
          userData,
        };
        ({ lbpWrapperInstance, tokenInstances } = await setupInitialState(
          contractInstances,
          initialState
        ));
      });
      it("» reverts tokens are in the pool", async () => {
        await lbpWrapperInstance
          .connect(admin)
          .retrieveProjectAndFundingToken(receiver.address);
      });
    });
  });
  describe("# add liquidity to the pool", () => {
    describe("$ adding liquidity fails", async () => {
      let userData;
      before(async () => {
        await tokenInstances[0]
          .connect(owner)
          .transfer(admin.address, INITIAL_BALANCES[0].mul(2).toString());
        await tokenInstances[1]
          .connect(owner)
          .transfer(admin.address, INITIAL_BALANCES[1].mul(2).toString());

        // Add fee amount on top
        amountToAddForFee = INITIAL_BALANCES[0]
          .mul(PRIME_DAO_FEE_PERCENTAGE)
          .div(HUNDRED_PERCENT);
        INITIAL_BALANCES[0] = INITIAL_BALANCES[0].add(amountToAddForFee);

        await tokenInstances[0]
          .connect(admin)
          .approve(lbpWrapperInstance.address, INITIAL_BALANCES[0].toString());
        await tokenInstances[1]
          .connect(admin)
          .approve(lbpWrapperInstance.address, INITIAL_BALANCES[1].toString());

        userData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256[]"],
          [JOIN_KIND_INIT, INITIAL_BALANCES]
        );
      });
      beforeEach(async () => {
        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          // funds,
        };
        ({ lbpWrapperInstance, tokenInstances } = await setupInitialState(
          contractInstances,
          initialState
        ));
      });
      it("» reverts when not called by owner", async () => {
        await expect(
          lbpWrapperInstance.fundPool(
            tokenAddresses,
            admin.address,
            FROM_INTERNAL_BALANCE,
            userData
          )
        ).to.be.revertedWith("LBPWrapper: only admin function");
      });

      it("» add liquidity to the pool", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);
        expect(
          (await lbpInstance.balanceOf(owner.address)).toString()
        ).to.equal("0");
        // check balance of beneficiary before joinPool()
        expect(await tokenInstances[0].balanceOf(beneficiary.address)).to.equal(
          0
        );

        await tokenInstances[0]
          .connect(owner)
          .transfer(admin.address, INITIAL_BALANCES[0].mul(2).toString());
        await tokenInstances[1]
          .connect(owner)
          .transfer(admin.address, INITIAL_BALANCES[1].mul(2).toString());

        await tokenInstances[0]
          .connect(admin)
          .approve(lbpWrapperInstance.address, INITIAL_BALANCES[0].toString());
        await tokenInstances[1]
          .connect(admin)
          .approve(lbpWrapperInstance.address, INITIAL_BALANCES[1].toString());
          
        const tx = await lbpWrapperInstance
          .connect(admin)
          .fundPool(
            tokenAddresses,
            admin.address,
            FROM_INTERNAL_BALANCE,
            userData
          );

        const receipt = await tx.wait();
        const vaultAddress = setup.vault.address;
        const vaultEvent = receipt.events.find(
          (log) => log.address === vaultAddress
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpWrapperInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(tokenAddresses[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(tokenAddresses[1]);
        expect(
          (await lbpInstance.balanceOf(owner.address)).toString()
        ).not.equal("0");
        // Check balance beneficiary after joinPool()
        expect(await tokenInstances[0].balanceOf(beneficiary.address)).to.equal(
          amountToAddForFee
        );
      });
      it("» revert when adding liquidity more then once", async () => {
        await expect(
          lbpWrapperInstance
            .connect(admin)
            .fundPool(
              tokenAddresses,
              admin.address,
              FROM_INTERNAL_BALANCE,
              userData
            )
        ).to.be.revertedWith("LBPWrapper: pool has already been funded");
      });
    });
  });
  context("# pause the LBP", async () => {
    it("» revert on being called by not the owner", async () => {
      await expect(
        lbpWrapperInstance.connect(owner).setSwapEnabled(false)
      ).to.be.revertedWith("LBPWrapper: only admin function");
    });
    it("» pauses the LBP", async () => {
      expect(await lbpWrapperInstance.admin()).to.equal(admin.address);
      await lbpWrapperInstance.connect(admin).setSwapEnabled(false);
      expect(await lbpInstance.getSwapEnabled()).to.equal(false);
    });
  });
});
