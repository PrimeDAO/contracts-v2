const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");
const { parseEther, parseUnits } = ethers.utils;

const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const {
  constants: { ZERO_ADDRESS },
  time,
} = require("@openzeppelin/test-helpers");
const VaultArtifact = require("../../imports/Vault.json");
const { BigNumber } = require("@ethersproject/bignumber");

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
      vaultInstance: vaultInstance,
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
  INITIAL_BALANCES,
  startWeights,
  startTime,
  endTime,
  endWeights,
  swapFee,
  primeFee,
  beneficiary
) => [
  factory,
  beneficiary,
  name,
  symbol,
  tokens,
  INITIAL_BALANCES,
  startWeights,
  [startTime, endTime],
  endWeights,
  swapFee,
  primeFee,
];

const setupInitialState = async (contractInstances, initialState) => {
  let amountToAddForFee;
  const HUNDRED_PERCENT = parseUnits("10", 18);
  const JOIN_KIND_INIT = 0;

  const signers = await ethers.getSigners();
  [owner, admin, beneficiary] = signers;
  amountToAddForFee = BigNumber.from(0);

  const {
    lbpFactoryInstance,
    lbpContractFactory,
    lbpWrapperInstance,
    tokenInstances,
  } = contractInstances;

  const tokenAddresses = tokenInstances.map((token) => token.address);

  const { initializeLBPParams, OwnerAdmin, fundingAmount, poolFunded } =
    initialState;

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

  if (fundingAmount) {
    const { initialBalances, primeDaoFeePercentage } = fundingAmount;

    const initialBalancesCopy = Object.assign({}, initialBalances);

    await tokenInstances[0]
      .connect(owner)
      .transfer(admin.address, initialBalancesCopy[0].mul(2).toString());
    await tokenInstances[1]
      .connect(owner)
      .transfer(admin.address, initialBalancesCopy[1].mul(2).toString());

    // Add fee amount on top
    if (primeDaoFeePercentage) {
      amountToAddForFee = initialBalancesCopy[0]
        .mul(primeDaoFeePercentage)
        .div(HUNDRED_PERCENT);
      initialBalancesCopy[0] = initialBalancesCopy[0].add(amountToAddForFee);
    }

    // reset allowance
    await tokenInstances[0]
      .connect(admin)
      .approve(lbpWrapperInstance.address, 0);
    await tokenInstances[1]
      .connect(admin)
      .approve(lbpWrapperInstance.address, 0);

    // approve allowance from admin to LBPWrapper
    await tokenInstances[0]
      .connect(admin)
      .approve(lbpWrapperInstance.address, initialBalancesCopy[0].toString());
    await tokenInstances[1]
      .connect(admin)
      .approve(lbpWrapperInstance.address, initialBalancesCopy[1].toString());

    if (poolFunded) {
      const userData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256[]"],
        [JOIN_KIND_INIT, initialBalances]
      );
      await lbpWrapperInstance.connect(admin).fundPool(
        tokenAddresses,
        admin.address,
        false, // fromInternalBalance
        userData
      );
    }
  }

  const lbpContractInstance = await lbpContractFactory.attach(
    await lbpWrapperInstance.lbp()
  );

  return {
    lbpWrapperInstance,
    tokenInstances,
    amountToAddForFee,
    lbpContractInstance,
    tokenAddresses,
  };
};

describe.only(">> Contract: LBPWrapper", () => {
  let setup;
  const NAME = "Test";
  const SYMBOL = "TT";
  let startTime = Math.floor(Date.now() / 1000);
  let endTime = startTime + 1000;
  let WEIGHTS = [parseEther("0.6").toString(), parseEther("0.4")];
  const HUNDRED_PERCENT = parseUnits("10", 18);
  // const FIVE_PERCENT = parseUnits("10", 16).mul(5);
  const INITIAL_BALANCES = [parseUnits("2000", 18), parseUnits("1000", 18)];
  const END_WEIGHTS = [parseEther("0.4").toString(), parseEther("0.6")];
  const SWAP_FEE_PERCENTAGE = parseUnits("1", 16);
  const TO_LOW_SWAP_FEE_PERCENTAGE = parseUnits("1", 10);
  const TO_HIGH_SWAP_FEE_PERCENTAGE = parseUnits("1", 18);
  const JOIN_KIND_INIT = 0;
  const EXIT_KIND = 1;
  const PRIME_DAO_FEE_PERCENTAGE_FIVE = parseUnits("5", 17);
  const PRIME_DAO_FEE_PERCENTAGE_ZERO = 0;
  const FROM_INTERNAL_BALANCE = false;

  let poolId,
    admin,
    owner,
    beneficiary,
    initializeLBPParams,
    lbpFactoryInstance,
    contractInstances,
    vaultInstance,
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
      vaultInstance,
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
      INITIAL_BALANCES,
      WEIGHTS,
      startTime,
      endTime,
      END_WEIGHTS,
      SWAP_FEE_PERCENTAGE,
      PRIME_DAO_FEE_PERCENTAGE_ZERO,
      beneficiary.address
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
          INITIAL_BALANCES,
          WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          TO_HIGH_SWAP_FEE_PERCENTAGE,
          PRIME_DAO_FEE_PERCENTAGE_ZERO,
          beneficiary.address
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
          INITIAL_BALANCES,
          WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          TO_LOW_SWAP_FEE_PERCENTAGE,
          PRIME_DAO_FEE_PERCENTAGE_ZERO,
          beneficiary.address
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
          INITIAL_BALANCES,
          WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          SWAP_FEE_PERCENTAGE,
          PRIME_DAO_FEE_PERCENTAGE_ZERO,
          ZERO_ADDRESS
        );
        await expect(
          lbpWrapperInstance
            .connect(owner)
            .initializeLBP(...invalidInitializeLBPParams)
        ).to.be.revertedWith(
          "LBPWrapper: _beneficiary can not be zero address"
        );
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
          PRIME_DAO_FEE_PERCENTAGE_ZERO
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
        lbpWrapperInstance.connect(owner).transferAdminRights(ZERO_ADDRESS)
      ).to.be.revertedWith("LBPWrapper: new admin can not be zero");
    });
    it("» success", async () => {
      await lbpWrapperInstance
        .connect(owner)
        .transferAdminRights(admin.address);
      expect(await lbpWrapperInstance.admin()).to.equal(admin.address);
    });
  });
  describe("# add liquidity to the pool", () => {
    describe("$ adding liquidity fails", () => {
      beforeEach(async () => {
        userData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256[]"],
          [JOIN_KIND_INIT, INITIAL_BALANCES]
        );
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          fundingAmount,
        };
        ({ lbpWrapperInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
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
    });
    describe("$ try adding liquidity twice", () => {
      beforeEach(async () => {
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          fundingAmount,
          poolFunded: true,
        };
        ({ lbpWrapperInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» reverts when adding liquidity twice", async () => {
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
    describe("$ adding liquidity with primeDaoFee being 5 percent", async () => {
      let userData, amountToAddForFee;

      beforeEach(async () => {
        initializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          INITIAL_BALANCES,
          WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          SWAP_FEE_PERCENTAGE,
          PRIME_DAO_FEE_PERCENTAGE_FIVE,
          beneficiary.address
        );

        userData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256[]"],
          [JOIN_KIND_INIT, INITIAL_BALANCES]
        );

        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_FIVE,
        };

        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          fundingAmount,
        };
        ({ lbpWrapperInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

        expect(
          (await lbpInstance.balanceOf(lbpWrapperInstance.address)).toString()
        ).to.equal("0");

        // check balance of beneficiary before joinPool()
        expect((await tokenInstances[0].balanceOf(beneficiary.address)).eq(0))
          .to.be.true;

        const tx = await lbpWrapperInstance
          .connect(admin)
          .fundPool(
            tokenAddresses,
            admin.address,
            FROM_INTERNAL_BALANCE,
            userData
          );

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = receipt.events.find(
          (log) => log.address === vaultAddress
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpWrapperInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(tokenAddresses[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(tokenAddresses[1]);
        expect((await lbpInstance.balanceOf(lbpWrapperInstance.address)).eq(0))
          .to.be.false;
        // Check balance beneficiary after joinPool()
        expect(await tokenInstances[0].balanceOf(beneficiary.address)).to.equal(
          amountToAddForFee
        );
      });
    });
    describe("$ adding liquidity with primeDaoFee being 0 percent", async () => {
      let userData, amountToAddForFee;

      beforeEach(async () => {
        userData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256[]"],
          [JOIN_KIND_INIT, INITIAL_BALANCES]
        );

        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_ZERO,
        };

        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          fundingAmount,
        };
        ({ lbpWrapperInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

        expect(
          (await lbpInstance.balanceOf(lbpWrapperInstance.address)).toString()
        ).to.equal("0");

        // check balance of beneficiary before joinPool()
        expect((await tokenInstances[0].balanceOf(beneficiary.address)).eq(0))
          .to.be.true;

        const tx = await lbpWrapperInstance
          .connect(admin)
          .fundPool(
            tokenAddresses,
            admin.address,
            FROM_INTERNAL_BALANCE,
            userData
          );

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = receipt.events.find(
          (log) => log.address === vaultAddress
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpWrapperInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(tokenAddresses[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(tokenAddresses[1]);
        expect((await lbpInstance.balanceOf(lbpWrapperInstance.address)).eq(0))
          .to.be.false;
        // Check balance beneficiary after joinPool()
        expect(await tokenInstances[0].balanceOf(beneficiary.address)).to.equal(
          amountToAddForFee
        );
      });
    });
  });
  describe("# setSwapEnabled", () => {
    beforeEach(async () => {
      const fundingAmount = {
        initialBalances: INITIAL_BALANCES,
        primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_ZERO,
      };

      const initialState = {
        initializeLBPParams,
        OwnerAdmin: true,
        fundingAmount,
        poolFunded: true,
      };
      ({ lbpWrapperInstance, tokenInstances, amountToAddForFee } =
        await setupInitialState(contractInstances, initialState));
    });
    it("» revert on being called by not the owner", async () => {
      await expect(
        lbpWrapperInstance.connect(owner).setSwapEnabled(false)
      ).to.be.revertedWith("LBPWrapper: only admin function");
    });
    it("» setSwapEnabled to false", async () => {
      expect(await lbpWrapperInstance.admin()).to.equal(admin.address);
      await lbpWrapperInstance.connect(admin).setSwapEnabled(false);
      expect(await lbpInstance.getSwapEnabled()).to.be.false;
    });
    it("» setSwapEnabled to true", async () => {
      expect(await lbpWrapperInstance.admin()).to.equal(admin.address);
      await lbpWrapperInstance.connect(admin).setSwapEnabled(true);
      expect(await lbpInstance.getSwapEnabled()).to.be.true;
    });
  });
  describe("# withdraw liquidity from the pool", () => {
    let exitUserData;
    describe("$ fails on call exit pool", () => {
      beforeEach(async () => {
        // Specifies funds and fee to be sent to setpInitialState
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          fundingAmount,
          poolFunded: true,
        };
        ({
          lbpWrapperInstance,
          tokenInstances,
          lbpContractInstance,
          tokenAddresses,
        } = await setupInitialState(contractInstances, initialState));

        const BPTbalance = await lbpContractInstance.balanceOf(
          lbpWrapperInstance.address
        );
        exitUserData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256"],
          [EXIT_KIND, BPTbalance.toString()]
        );
      });
      it("» reverts when trying to remove liquidity where receiver address is zero address", async () => {
        await expect(
          lbpWrapperInstance
            .connect(admin)
            .removeLiquidity(tokenAddresses, ZERO_ADDRESS, false, exitUserData)
        ).to.be.revertedWith(
          "LBPWrapper: receiver of project and funding tokens can't be zero"
        );
      });
      it("» reverts when trying to remove liquidity before endTime", async () => {
        await expect(
          lbpWrapperInstance
            .connect(admin)
            .removeLiquidity(tokenAddresses, admin.address, false, exitUserData)
        ).to.be.revertedWith(
          "LBPWrapper: can not remove liqudity from the pool before endtime"
        );
      });
    });
    describe("$ success on call exit pool", () => {
      // let exitUserData;
      beforeEach(async () => {
        // Specifies funds and fee to be sent to setpInitialState
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          fundingAmount,
          poolFunded: true,
        };
        ({
          lbpWrapperInstance,
          tokenInstances,
          lbpContractInstance,
          tokenAddresses,
        } = await setupInitialState(contractInstances, initialState));

        const BPTbalance = await lbpContractInstance.balanceOf(
          lbpWrapperInstance.address
        );
        exitUserData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256"],
          [EXIT_KIND, BPTbalance.toString()]
        );
      });
      it("» exits or remove liquidity after endTime", async () => {
        await time.increase(1000);
        // get balance before exiting the pool
        const { balances: poolBalances } = await vaultInstance.getPoolTokens(
          await lbpContractInstance.getPoolId()
        );
        // exit pool
        await lbpWrapperInstance
          .connect(admin)
          .removeLiquidity(tokenAddresses, admin.address, false, exitUserData);
        // balance after exit pool
        const { balances: poolBalancesAfterExit } =
          await vaultInstance.getPoolTokens(
            await lbpContractInstance.getPoolId()
          );

        expect(
          await lbpContractInstance.balanceOf(lbpWrapperInstance.address)
        ).to.equal(0);
        for (let i = 0; i < poolBalances.length; i++) {
          expect(poolBalances[i].gt(poolBalancesAfterExit[i])).to.be.true;
        }
      });
    });
  });
  describe("# withdraw Balancer pool tokens", () => {
    describe("$ fails on withdrawing pool tokens", () => {
      // let exitUserData;
      beforeEach(async () => {
        // Specifies funds and fee to be sent to setpInitialState
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          fundingAmount,
          poolFunded: true,
        };
        ({
          lbpWrapperInstance,
          tokenInstances,
          lbpContractInstance,
          tokenAddresses,
        } = await setupInitialState(contractInstances, initialState));

        const BPTbalance = await lbpContractInstance.balanceOf(
          lbpWrapperInstance.address
        );
        exitUserData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256"],
          [EXIT_KIND, BPTbalance.toString()]
        );
      });
      it("» reverts when receiver address is zero address", async () => {
        await expect(
          lbpWrapperInstance.connect(admin).withdrawPoolTokens(ZERO_ADDRESS)
        ).to.be.revertedWith(
          "LBPWrapper: receiver of pool tokens can't be zero"
        );
      });
      it("» reverts when trying to withdraw before end time", async () => {
        await expect(
          lbpWrapperInstance.connect(admin).withdrawPoolTokens(admin.address)
        ).to.be.revertedWith(
          "LBPWrapper: can not withdraw pool tokens before endtime"
        );
      });
    });
    describe("$ succes on withdraw pool tokens", () => {
      // let exitUserData;
      beforeEach(async () => {
        // Specifies funds and fee to be sent to setpInitialState
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          OwnerAdmin: true,
          fundingAmount,
          poolFunded: true,
        };
        ({
          lbpWrapperInstance,
          tokenInstances,
          lbpContractInstance,
          tokenAddresses,
        } = await setupInitialState(contractInstances, initialState));

        const BPTbalance = await lbpContractInstance.balanceOf(
          lbpWrapperInstance.address
        );
        exitUserData = ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256"],
          [EXIT_KIND, BPTbalance.toString()]
        );
      });
      it("» withdraw pool tokens", async () => {
        await time.increase(1000);
        // check balance before withdrawing pool tokens
        const balance = await lbpContractInstance.balanceOf(
          lbpWrapperInstance.address
        );
        await lbpWrapperInstance
          .connect(admin)
          .withdrawPoolTokens(admin.address);
        expect(await lbpContractInstance.balanceOf(admin.address)).to.equal(
          balance
        );
      });
      it("» reverts when withdrawing again", async () => {
        await time.increase(1000);
        await lbpWrapperInstance
          .connect(admin)
          .withdrawPoolTokens(admin.address);
        await expect(
          lbpWrapperInstance.connect(admin).withdrawPoolTokens(admin.address)
        ).to.be.revertedWith(
          "LBPWrapper: wrapper does not have any pool tokens to withdraw"
        );
      });
      it("» reverts when trying to remove liquidity after withdrawing pool tokens", async () => {
        await time.increase(1000);
        await lbpWrapperInstance
          .connect(admin)
          .withdrawPoolTokens(admin.address);
        await expect(
          lbpWrapperInstance
            .connect(admin)
            .removeLiquidity(tokenAddresses, admin.address, false, exitUserData)
        ).to.be.revertedWith(
          "LBPWrapper: wrapper does not have any pool tokens to remove liquidity"
        );
      });
    });
  });
});
