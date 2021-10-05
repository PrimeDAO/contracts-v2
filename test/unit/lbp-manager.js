const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { parseEther, parseUnits } = ethers.utils;
const {
  constants: { ZERO_ADDRESS },
  time,
} = require("@openzeppelin/test-helpers");
const { BigNumber } = require("@ethersproject/bignumber");

const VaultArtifact = require("../../imports/Vault.json");
const balancer = require("../helpers/balancer.js");
const tokens = require("../helpers/tokens.js");
const PROJECT_TOKEN_INDEX = 0;

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    const { deploy } = deployments;
    const { root } = await ethers.getNamedSigners();

    const vaultInstance = await balancer.getVaultInstance();
    const lbpFactoryInstance = await balancer.getLbpFactoryInstance(
      vaultInstance
    );

    await deploy("LbpManager", {
      contract: "LBPManager",
      from: root.address,
      log: true,
    });

    const contractInstances = {
      vaultInstance: vaultInstance,
      lbpFactoryInstance: lbpFactoryInstance,
      lbpContractFactory: await balancer.getLbpFactory(root),
      lbpManagerInstance: await ethers.getContract("LbpManager"),
      tokenInstances: await tokens.getErc20TokenInstances(2, root),
    };

    return { ...contractInstances };
  }
);

const reverseArray = (array) => {
  return array.slice().reverse();
};

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
  fees,
  beneficiary,
  METADATA
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
  fees,
  METADATA,
];

const setupInitialState = async (contractInstances, initialState) => {
  let amountToAddForFee = BigNumber.from(0);

  const HUNDRED_PERCENT = parseUnits("10", 18);
  const signers = await ethers.getSigners();

  [owner, admin, beneficiary] = signers;

  const {
    lbpContractFactory,
    lbpManagerInstance,
    tokenInstances,
  } = contractInstances;

  const { initializeLBPParams, noOwnerTransfer, fundingAmount, poolFunded } =
    initialState;

  const tokenAddresses = tokenInstances.map((token) => token.address);

  if (initializeLBPParams) {
    if (noOwnerTransfer) {
      await lbpManagerInstance
        .connect(owner)
        .initializeLBP(...initializeLBPParams);
    } else {
      await lbpManagerInstance
        .connect(admin)
        .initializeLBP(...initializeLBPParams);
    }
  }

  if (fundingAmount) {
    const { initialBalances, feePercentage } = fundingAmount;

    const initialBalancesCopy = Object.assign({}, initialBalances);

    await tokenInstances[0]
      .connect(owner)
      .transfer(admin.address, initialBalancesCopy[0].mul(2));
    await tokenInstances[1]
      .connect(owner)
      .transfer(admin.address, initialBalancesCopy[1].mul(2));

    // Add fee amount on top
    if (feePercentage) {
      amountToAddForFee =
        initialBalancesCopy[PROJECT_TOKEN_INDEX].mul(feePercentage).div(
          HUNDRED_PERCENT
        );
      initialBalancesCopy[PROJECT_TOKEN_INDEX] =
        initialBalancesCopy[PROJECT_TOKEN_INDEX].add(amountToAddForFee);
    }

    // reset allowance
    await tokenInstances[0]
      .connect(admin)
      .approve(lbpManagerInstance.address, 0);
    await tokenInstances[1]
      .connect(admin)
      .approve(lbpManagerInstance.address, 0);

    // approve allowance from admin to LBPManager
    await tokenInstances[0]
      .connect(admin)
      .approve(lbpManagerInstance.address, initialBalancesCopy[0]);
    await tokenInstances[1]
      .connect(admin)
      .approve(lbpManagerInstance.address, initialBalancesCopy[1]);

    if (poolFunded) {
      await lbpManagerInstance.connect(admin).addLiquidity(admin.address);
    }
  }

  const lbpContractInstance = await lbpContractFactory.attach(
    await lbpManagerInstance.lbp()
  );

  return {
    lbpManagerInstance,
    tokenInstances,
    amountToAddForFee,
    lbpContractInstance,
    tokenAddresses,
  };
};

describe.only(">> Contract: LBPManager", () => {
  let poolId,
    admin,
    owner,
    beneficiary,
    initializeLBPParams,
    lbpFactoryInstance,
    contractInstances,
    vaultInstance,
    lbpManagerInstance,
    tokenInstances,
    lbpContractFactory,
    lbpInstance,
    tokenAddresses,
    fees;

  const NAME = "Test";
  const SYMBOL = "TT";
  const INITIAL_BALANCES = [parseUnits("2000", 18), parseUnits("1000", 18)];
  const END_WEIGHTS = [parseEther("0.4"), parseEther("0.6")];
  const SWAP_FEE_PERCENTAGE = parseUnits("1", 16);
  const TO_LOW_SWAP_FEE_PERCENTAGE = parseUnits("1", 10);
  const TO_HIGH_SWAP_FEE_PERCENTAGE = parseUnits("1", 18);
  const FEE_PERCENTAGE_FIVE = parseUnits("5", 17);
  const FEE_PERCENTAGE_ONE = parseUnits("1", 17);
  const FEE_PERCENTAGE_ZERO = 0;
  const METADATA = "0x7B502C3A1F48C8609AE212CDFB639DEE39673F5E"; // Random hash string

  let startTime = Math.floor(Date.now() / 1000);
  let endTime = startTime + 1000;
  let START_WEIGHTS = [parseEther("0.6"), parseEther("0.4")];

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
      lbpManagerInstance,
      tokenInstances,
    } = contractInstances);

    tokenAddresses = tokenInstances.map((token) => token.address);

    fees = [SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_ZERO];

    initializeLBPParams = paramGenerator.initializeParams(
      lbpFactoryInstance.address,
      NAME,
      SYMBOL,
      tokenAddresses,
      INITIAL_BALANCES,
      START_WEIGHTS,
      startTime,
      endTime,
      END_WEIGHTS,
      fees,
      beneficiary.address,
      METADATA
    );
  });

  describe("# deploy LBP using Manager", () => {
    describe("$ deploy LBP using Manager fails", () => {
      let invalidInitializeLBPParams;

      it("» revert on swap fee to high", async () => {
        fees = [TO_HIGH_SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_ZERO];
        invalidInitializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          INITIAL_BALANCES,
          START_WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          fees,
          beneficiary.address,
          METADATA
        );
        await expect(
          lbpManagerInstance
            .connect(owner)
            .initializeLBP(...invalidInitializeLBPParams)
        ).to.be.revertedWith(
          "BAL#202" //MAX_SWAP_FEE_PERCENTAGE
        );
      });
      it("» revert on swap fee to low", async () => {
        fees = [TO_LOW_SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_ZERO];
        invalidInitializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          INITIAL_BALANCES,
          START_WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          fees,
          beneficiary.address,
          METADATA
        );
        await expect(
          lbpManagerInstance
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
          START_WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          fees,
          ZERO_ADDRESS,
          METADATA
        );
        await expect(
          lbpManagerInstance
            .connect(owner)
            .initializeLBP(...invalidInitializeLBPParams)
        ).to.be.revertedWith("LBPManager: _beneficiary is zero");
      });
      it("» revert on token list bigger then 2", async () => {
        const largeTokenList = await tokens.getErc20TokenInstances(4, owner);
        const largeTokenListAddresses = largeTokenList
          .map((token) => token.address)
          .sort((a, b) => a - b);

        invalidInitializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          largeTokenListAddresses,
          INITIAL_BALANCES,
          START_WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          fees,
          beneficiary.address,
          METADATA
        );
        await expect(
          lbpManagerInstance
            .connect(owner)
            .initializeLBP(...invalidInitializeLBPParams)
        ).to.be.revertedWith("BAL#103");
      });
    });
    describe("$ deploy LBP using Manager succeeds", () => {
      it("» success", async () => {
        await lbpManagerInstance
          .connect(owner)
          .initializeLBP(...initializeLBPParams);
        lbpInstance = lbpContractFactory.attach(await lbpManagerInstance.lbp());
        poolId = await lbpInstance.getPoolId();

        expect(await lbpManagerInstance.lbp()).not.equal(ZERO_ADDRESS);
        expect(await lbpManagerInstance.beneficiary()).to.equal(
          beneficiary.address
        );
        expect(await lbpManagerInstance.feePercentage()).to.equal(
          FEE_PERCENTAGE_ZERO
        );
        expect(await lbpManagerInstance.metadata()).to.equal(
          METADATA.toLowerCase()
        );
      });
      it("» reverts when invoking it again", async () => {
        await lbpManagerInstance
          .connect(owner)
          .initializeLBP(...initializeLBPParams);
        await expect(
          lbpManagerInstance
            .connect(admin)
            .initializeLBP(...initializeLBPParams)
        ).to.be.revertedWith("LBPManager: already initialized");
      });
    });
  });
  describe("# transfers ownership of LBPManager", async () => {
    beforeEach(async () => {
      const initialState = {
        initializeLBPParams,
        noOwnerTransfer: true,
      };

      ({ lbpManagerInstance } = await setupInitialState(
        contractInstances,
        initialState
      ));
    });
    it("» reverts when new owner address is zero", async () => {
      await expect(
        lbpManagerInstance.connect(owner).transferAdminRights(ZERO_ADDRESS)
      ).to.be.revertedWith("LBPManager: new admin is zero");
    });
    it("» success", async () => {
      await lbpManagerInstance
        .connect(owner)
        .transferAdminRights(admin.address);
      expect(await lbpManagerInstance.admin()).to.equal(admin.address);
    });
  });
  describe("# calculate project tokens required", () => {
    describe("$ calculate with zero percent", () => {
      beforeEach(async () => {
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };

        const initialState = {
          initializeLBPParams,
          fundingAmount,
        };

        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        expect(await lbpManagerInstance.projectTokensRequired()).to.equal(
          amountToAddForFee.add(INITIAL_BALANCES[0])
        );
      });
    });
    describe("$ calculate with five percent", () => {
      beforeEach(async () => {
        fees = [SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_FIVE];
        initializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          INITIAL_BALANCES,
          START_WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          fees,
          beneficiary.address,
          METADATA
        );

        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_FIVE,
        };

        const initialState = {
          initializeLBPParams,
          fundingAmount,
        };

        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        expect(await lbpManagerInstance.projectTokensRequired()).to.equal(
          amountToAddForFee.add(INITIAL_BALANCES[0])
        );
      });
    });
  });
  describe("# add liquidity to the pool", () => {
    describe("$ adding liquidity fails", () => {
      beforeEach(async () => {
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          fundingAmount,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» reverts when not called by owner", async () => {
        await expect(
          lbpManagerInstance.addLiquidity(admin.address)
        ).to.be.revertedWith("LBPManager: caller is not admin");
      });
    });
    describe("$ try adding liquidity twice", () => {
      beforeEach(async () => {
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };

        const initialState = {
          initializeLBPParams,
          fundingAmount,
          poolFunded: true,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» reverts when adding liquidity twice", async () => {
        await expect(
          lbpManagerInstance.connect(admin).addLiquidity(admin.address)
        ).to.be.revertedWith("LBPManager: pool already funded");
      });
    });
    describe("$ adding liquidity with 5 percent fee", async () => {
      let amountToAddForFee;

      beforeEach(async () => {
        fees = [SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_FIVE];

        initializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          INITIAL_BALANCES,
          START_WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          fees,
          beneficiary.address,
          METADATA
        );

        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_FIVE,
        };

        const initialState = {
          initializeLBPParams,
          fundingAmount,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

        expect(
          (await lbpInstance.balanceOf(lbpManagerInstance.address)).toString()
        ).to.equal("0");

        // check balance of beneficiary before joinPool()
        expect(
          (
            await tokenInstances[PROJECT_TOKEN_INDEX].balanceOf(
              beneficiary.address
            )
          ).eq(0)
        ).to.be.true;

        const tx = await lbpManagerInstance
          .connect(admin)
          .addLiquidity(admin.address);

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = receipt.events.find(
          (log) => log.address === vaultAddress
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(tokenAddresses[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(tokenAddresses[1]);
        expect((await lbpInstance.balanceOf(lbpManagerInstance.address)).eq(0))
          .to.be.false;
        // Check balance beneficiary after joinPool()
        expect(
          await tokenInstances[PROJECT_TOKEN_INDEX].balanceOf(
            beneficiary.address
          )
        ).to.equal(amountToAddForFee);
      });
    });
    describe("$ adding liquidity with 1 percent fee", async () => {
      let amountToAddForFee;

      beforeEach(async () => {
        fees = [SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_ONE];

        initializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          INITIAL_BALANCES,
          START_WEIGHTS,
          startTime,
          endTime,
          END_WEIGHTS,
          fees,
          beneficiary.address,
          METADATA
        );

        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ONE,
        };

        const initialState = {
          initializeLBPParams,
          fundingAmount,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

        expect(
          (await lbpInstance.balanceOf(lbpManagerInstance.address)).toString()
        ).to.equal("0");

        // check balance of beneficiary before joinPool()
        expect(
          (
            await tokenInstances[PROJECT_TOKEN_INDEX].balanceOf(
              beneficiary.address
            )
          ).eq(0)
        ).to.be.true;

        const tx = await lbpManagerInstance
          .connect(admin)
          .addLiquidity(admin.address);

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = receipt.events.find(
          (log) => log.address === vaultAddress
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(tokenAddresses[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(tokenAddresses[1]);
        expect((await lbpInstance.balanceOf(lbpManagerInstance.address)).eq(0))
          .to.be.false;
        // Check balance beneficiary after joinPool()
        expect(
          await tokenInstances[PROJECT_TOKEN_INDEX].balanceOf(
            beneficiary.address
          )
        ).to.equal(amountToAddForFee);
      });
    });
    describe("$ adding liquidity with 0 percent fee", async () => {
      let amountToAddForFee;

      beforeEach(async () => {
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };

        const initialState = {
          initializeLBPParams,
          fundingAmount,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

        expect(
          (await lbpInstance.balanceOf(lbpManagerInstance.address)).toString()
        ).to.equal("0");

        // check balance of beneficiary before joinPool()
        expect(
          (
            await tokenInstances[PROJECT_TOKEN_INDEX].balanceOf(
              beneficiary.address
            )
          ).eq(0)
        ).to.be.true;

        const tx = await lbpManagerInstance
          .connect(admin)
          .addLiquidity(admin.address);

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = receipt.events.find(
          (log) => log.address === vaultAddress
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(tokenAddresses[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(tokenAddresses[1]);
        expect((await lbpInstance.balanceOf(lbpManagerInstance.address)).eq(0))
          .to.be.false;
        // Check balance beneficiary after joinPool()
        expect(
          await tokenInstances[PROJECT_TOKEN_INDEX].balanceOf(
            beneficiary.address
          )
        ).to.equal(amountToAddForFee);
      });
    });
    describe("$ adding liquidity with unsorted tokenList and 5 percent fee", async () => {
      let amountToAddForFee;

      beforeEach(async () => {
        amountToAddForFee = BigNumber.from(0);

        // reverse START_weights and amounts
        const reverseInitialBalance = reverseArray(INITIAL_BALANCES);
        const reverseWeights = reverseArray(START_WEIGHTS);
        const reverseEndWeights = reverseArray(END_WEIGHTS);
        fees = [SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_FIVE];

        initializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          reverseInitialBalance,
          reverseWeights,
          startTime,
          endTime,
          reverseEndWeights,
          fees,
          beneficiary.address,
          METADATA
        );

        const fundingAmount = {
          initialBalances: reverseInitialBalance,
          feePercentage: FEE_PERCENTAGE_FIVE,
        };

        const initialState = {
          initializeLBPParams,
          fundingAmount,
          PROJECT_TOKEN_INDEX: PROJECT_TOKEN_INDEX,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

        expect(
          (await lbpInstance.balanceOf(lbpManagerInstance.address)).toString()
        ).to.equal("0");

        // check balance of beneficiary before joinPool()
        expect((await tokenInstances[0].balanceOf(beneficiary.address)).eq(0))
          .to.be.true;

        const tx = await lbpManagerInstance
          .connect(admin)
          .addLiquidity(admin.address);

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = receipt.events.find(
          (log) => log.address === vaultAddress
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(tokenAddresses[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(tokenAddresses[1]);
        expect((await lbpInstance.balanceOf(lbpManagerInstance.address)).eq(0))
          .to.be.false;
        // Check balance beneficiary after joinPool()
        expect(
          await tokenInstances[PROJECT_TOKEN_INDEX].balanceOf(
            beneficiary.address
          )
        ).to.equal(amountToAddForFee);
      });
    });
    describe("$ adding liquidity with unsorted tokenList and 0 percent fee", async () => {
      let amountToAddForFee;

      beforeEach(async () => {
        amountToAddForFee = BigNumber.from(0);

        // reverse START_weights and amounts
        const reverseInitialBalance = reverseArray(INITIAL_BALANCES);
        const reverseWeights = reverseArray(START_WEIGHTS);
        const reverseEndWeights = reverseArray(END_WEIGHTS);

        initializeLBPParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          tokenAddresses,
          reverseInitialBalance,
          reverseWeights,
          startTime,
          endTime,
          reverseEndWeights,
          fees,
          beneficiary.address,
          METADATA
        );

        const fundingAmount = {
          initialBalances: reverseInitialBalance,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };

        const initialState = {
          initializeLBPParams,
          fundingAmount,
          PROJECT_TOKEN_INDEX: PROJECT_TOKEN_INDEX,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

        expect(
          (await lbpInstance.balanceOf(lbpManagerInstance.address)).toString()
        ).to.equal("0");

        // check balance of beneficiary before joinPool()
        expect((await tokenInstances[0].balanceOf(beneficiary.address)).eq(0))
          .to.be.true;

        const tx = await lbpManagerInstance
          .connect(admin)
          .addLiquidity(admin.address);

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = receipt.events.find(
          (log) => log.address === vaultAddress
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(tokenAddresses[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(tokenAddresses[1]);
        expect((await lbpInstance.balanceOf(lbpManagerInstance.address)).eq(0))
          .to.be.false;
        // Check balance beneficiary after joinPool()
        expect(
          await tokenInstances[PROJECT_TOKEN_INDEX].balanceOf(
            beneficiary.address
          )
        ).to.equal(amountToAddForFee);
      });
    });
  });
  describe("# setSwapEnabled", () => {
    beforeEach(async () => {
      const fundingAmount = {
        initialBalances: INITIAL_BALANCES,
        feePercentage: FEE_PERCENTAGE_ZERO,
      };

      const initialState = {
        initializeLBPParams,
        fundingAmount,
        poolFunded: true,
      };
      ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
        await setupInitialState(contractInstances, initialState));
    });
    it("» revert on being called by not the owner", async () => {
      await expect(
        lbpManagerInstance.connect(owner).setSwapEnabled(false)
      ).to.be.revertedWith("LBPManager: caller is not admin");
    });
    it("» setSwapEnabled to false", async () => {
      expect(await lbpManagerInstance.admin()).to.equal(admin.address);
      await lbpManagerInstance.connect(admin).setSwapEnabled(false);
      expect(await lbpInstance.getSwapEnabled()).to.be.false;
    });
    it("» setSwapEnabled to true", async () => {
      expect(await lbpManagerInstance.admin()).to.equal(admin.address);
      await lbpManagerInstance.connect(admin).setSwapEnabled(true);
      expect(await lbpInstance.getSwapEnabled()).to.be.true;
    });
  });
  describe("# withdraw liquidity from the pool", () => {
    describe("$ fails on call exit pool", () => {
      beforeEach(async () => {
        // Specifies funds and fee to be sent to setpInitialState
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          fundingAmount,
          poolFunded: true,
        };
        ({
          lbpManagerInstance,
          tokenInstances,
          lbpContractInstance,
          tokenAddresses,
        } = await setupInitialState(contractInstances, initialState));
      });
      it("» it reverts on not called by admin", async () => {
        await expect(
          lbpManagerInstance.removeLiquidity(admin.address)
        ).to.be.revertedWith("LBPManager: caller is not admin");
      });
      it("» reverts when trying to remove liquidity where receiver address is zero address", async () => {
        await expect(
          lbpManagerInstance.connect(admin).removeLiquidity(ZERO_ADDRESS)
        ).to.be.revertedWith("LBPManager: receiver is zero");
      });
      it("» reverts when trying to remove liquidity before endTime", async () => {
        await expect(
          lbpManagerInstance.connect(admin).removeLiquidity(admin.address)
        ).to.be.revertedWith("LBPManager: endtime not reached");
      });
    });
    describe("$ success on call exit pool", () => {
      beforeEach(async () => {
        // Specifies funds and fee to be sent to setpInitialState
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          fundingAmount,
          poolFunded: true,
        };
        ({
          lbpManagerInstance,
          tokenInstances,
          lbpContractInstance,
          tokenAddresses,
        } = await setupInitialState(contractInstances, initialState));
      });
      it("» exits or remove liquidity after endTime", async () => {
        await time.increase(1000);
        // get balance before exiting the pool
        const { balances: poolBalances } = await vaultInstance.getPoolTokens(
          await lbpContractInstance.getPoolId()
        );
        // exit pool
        await lbpManagerInstance.connect(admin).removeLiquidity(admin.address);
        // balance after exit pool
        const { balances: poolBalancesAfterExit } =
          await vaultInstance.getPoolTokens(
            await lbpContractInstance.getPoolId()
          );

        expect(
          await lbpContractInstance.balanceOf(lbpManagerInstance.address)
        ).to.equal(0);
        for (let i = 0; i < poolBalances.length; i++) {
          expect(poolBalances[i].gt(poolBalancesAfterExit[i])).to.be.true;
        }
      });
    });
  });
  describe("# withdraw Balancer pool tokens", () => {
    describe("$ fails on withdrawing pool tokens", () => {
      beforeEach(async () => {
        // Specifies funds and fee to be sent to setpInitialState
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          fundingAmount,
          poolFunded: true,
        };
        ({
          lbpManagerInstance,
          tokenInstances,
          lbpContractInstance,
          tokenAddresses,
        } = await setupInitialState(contractInstances, initialState));
      });
      it("» reverts when receiver address is zero address", async () => {
        await expect(
          lbpManagerInstance.connect(admin).withdrawPoolTokens(ZERO_ADDRESS)
        ).to.be.revertedWith("LBPManager: receiver is zero");
      });
      it("» reverts when trying to withdraw before end time", async () => {
        await expect(
          lbpManagerInstance.connect(admin).withdrawPoolTokens(admin.address)
        ).to.be.revertedWith("LBPManager: endtime not reached");
      });
    });
    describe("$ succes on withdraw pool tokens", () => {
      beforeEach(async () => {
        // Specifies funds and fee to be sent to setpInitialState
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPParams,
          fundingAmount,
          poolFunded: true,
        };
        ({
          lbpManagerInstance,
          tokenInstances,
          lbpContractInstance,
          tokenAddresses,
        } = await setupInitialState(contractInstances, initialState));
      });
      it("» withdraw pool tokens", async () => {
        await time.increase(1000);
        // check balance before withdrawing pool tokens
        const balance = await lbpContractInstance.balanceOf(
          lbpManagerInstance.address
        );
        await lbpManagerInstance
          .connect(admin)
          .withdrawPoolTokens(admin.address);
        expect(await lbpContractInstance.balanceOf(admin.address)).to.equal(
          balance
        );
      });
      it("» reverts when withdrawing again", async () => {
        await time.increase(1000);
        await lbpManagerInstance
          .connect(admin)
          .withdrawPoolTokens(admin.address);
        await expect(
          lbpManagerInstance.connect(admin).withdrawPoolTokens(admin.address)
        ).to.be.revertedWith("LBPManager: no BPT token balance");
      });
      it("» reverts when trying to remove liquidity after withdrawing pool tokens", async () => {
        await time.increase(1000);
        await lbpManagerInstance
          .connect(admin)
          .withdrawPoolTokens(admin.address);
        await expect(
          lbpManagerInstance.connect(admin).removeLiquidity(admin.address)
        ).to.be.revertedWith("LBPManager: no BPT token balance");
      });
    });
  });
});
