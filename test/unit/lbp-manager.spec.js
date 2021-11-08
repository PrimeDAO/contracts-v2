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

const filterPoolBalancesChangedEvent = (
  receipt,
  address,
  interface,
  eventName
) =>
  receipt.events.find(
    (log) =>
      log.address === address && interface.parseLog(log).name === eventName
  );

const reverseArray = (array) => {
  return array.slice().reverse();
};

const sortAddresses = (token1, token2) =>
  BigNumber.from(token1).gt(BigNumber.from(token2))
    ? [token2, token1]
    : [token1, token2];

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

  const HUNDRED_PERCENT = parseUnits("1", 18);
  const signers = await ethers.getSigners();

  [owner, admin, beneficiary] = signers;

  const { lbpContractFactory, lbpManagerInstance, tokenInstances } =
    contractInstances;

  const {
    initializeLBPManagerParams,
    noOwnerTransfer,
    fundingAmount,
    poolFunded,
  } = initialState;

  const tokenAddresses = tokenInstances.map((token) => token.address);

  if (initializeLBPManagerParams) {
    if (noOwnerTransfer) {
      await lbpManagerInstance
        .connect(owner)
        .initializeLBPManager(...initializeLBPManagerParams);
    } else {
      await lbpManagerInstance
        .connect(admin)
        .initializeLBPManager(...initializeLBPManagerParams);
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
      await lbpManagerInstance.connect(admin).initializeLBP(admin.address);
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

describe(">> Contract: LBPManager", () => {
  let poolId,
    admin,
    owner,
    beneficiary,
    initializeLBPManagerParams,
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

    initializeLBPManagerParams = paramGenerator.initializeParams(
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
  describe("# initalizeLBPManger", () => {
    describe("$ initialize fails", () => {
      it("» revert on already initialized", async () => {
        await lbpManagerInstance.initializeLBPManager(
          ...initializeLBPManagerParams
        );
        await expect(
          lbpManagerInstance.initializeLBPManager(...initializeLBPManagerParams)
        ).to.be.revertedWith("LBPManager: already initialized");
      });
      it("» revert on beneficiary address being zero", async () => {
        invalidInitializeLBPManagerParams = paramGenerator.initializeParams(
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
            .initializeLBPManager(...invalidInitializeLBPManagerParams)
        ).to.be.revertedWith("LBPManager: _beneficiary is zero");
      });
      it("» revert on swapFeePercentage to low", async () => {
        fees = [TO_LOW_SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_ZERO];
        invalidInitializeLBPManagerParams = paramGenerator.initializeParams(
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
            .initializeLBPManager(...invalidInitializeLBPManagerParams)
        ).to.be.revertedWith("LBPManager: swapFeePercentage to low");
      });
      it("» revert on swapFeePercentage to high", async () => {
        fees = [TO_HIGH_SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_ZERO];
        invalidInitializeLBPManagerParams = paramGenerator.initializeParams(
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
            .initializeLBPManager(...invalidInitializeLBPManagerParams)
        ).to.be.revertedWith("LBPManager: swapFeePercentage to high");
      });
      it("» revert on token list bigger then 2", async () => {
        const largeTokenList = await tokens.getErc20TokenInstances(4, owner);
        const largeTokenListAddresses = largeTokenList
          .map((token) => token.address)
          .sort((a, b) => a - b);

        invalidInitializeLBPManagerParams = paramGenerator.initializeParams(
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
          lbpManagerInstance.initializeLBPManager(
            ...invalidInitializeLBPManagerParams
          )
        ).to.revertedWith("LBPManager: arrays wrong size");
      });
      it("» revert when both tokens are same", async () => {
        invalidInitializeLBPManagerParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          [tokenAddresses[0], tokenAddresses[0]],
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
          lbpManagerInstance.initializeLBPManager(
            ...invalidInitializeLBPManagerParams
          )
        ).to.revertedWith("LBPManager: tokens can't be same");
      });
      it("» revert when startTime is after endTime", async () => {
        invalidInitializeLBPManagerParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          [tokenAddresses[0], tokenAddresses[1]],
          INITIAL_BALANCES,
          START_WEIGHTS,
          endTime,
          startTime,
          END_WEIGHTS,
          fees,
          beneficiary.address,
          METADATA
        );
        await expect(
          lbpManagerInstance.initializeLBPManager(
            ...invalidInitializeLBPManagerParams
          )
        ).to.revertedWith("LBPManager: startTime > endTime");
      });
    });
    describe("$ initialize succeeds", () => {
      let projectTokenIndex;
      it("» succeeds", async () => {
        if (tokenAddresses[0] > tokenAddresses[1]) projectTokenIndex = 1;
        else projectTokenIndex = 0;

        await lbpManagerInstance
          .connect(owner)
          .initializeLBPManager(...initializeLBPManagerParams);
        expect(await lbpManagerInstance.feePercentage()).to.equal(fees[1]);
        expect(await lbpManagerInstance.swapFeePercentage()).to.equal(fees[0]);
        expect(await lbpManagerInstance.beneficiary()).to.equal(
          beneficiary.address
        );
        expect(await lbpManagerInstance.admin()).to.equal(owner.address);
        expect(await lbpManagerInstance.metadata()).to.equal(
          METADATA.toLowerCase()
        );
        expect(await lbpManagerInstance.name()).to.equal(NAME);
        expect(await lbpManagerInstance.symbol()).to.equal(SYMBOL);

        expect(
          (await lbpManagerInstance.amounts(0)).eq(INITIAL_BALANCES[0])
        ).to.equal(true);
        expect(
          (await lbpManagerInstance.amounts(1)).eq(INITIAL_BALANCES[1])
        ).to.equal(true);
        expect(await lbpManagerInstance.tokenList(0)).to.equal(
          tokenAddresses[0]
        );
        expect(await lbpManagerInstance.tokenList(1)).to.equal(
          tokenAddresses[1]
        );
        expect(
          (await lbpManagerInstance.startWeights(0)).eq(START_WEIGHTS[0])
        ).to.equal(true);
        expect(
          (await lbpManagerInstance.startWeights(1)).eq(START_WEIGHTS[1])
        ).to.equal(true);
        expect(
          (await lbpManagerInstance.endWeights(0)).eq(END_WEIGHTS[0])
        ).to.equal(true);
        expect(
          (await lbpManagerInstance.endWeights(1)).eq(END_WEIGHTS[1])
        ).to.equal(true);
        expect(await lbpManagerInstance.lbpFactory()).to.equal(
          lbpFactoryInstance.address
        );
        expect(
          (await lbpManagerInstance.startTimeEndTime(0)).eq(startTime)
        ).to.equal(true);
        expect(
          (await lbpManagerInstance.startTimeEndTime(1)).eq(endTime)
        ).to.equal(true);
        expect(await lbpManagerInstance.projectTokenIndex()).to.equal(
          projectTokenIndex
        );
      });
    });
  });
  describe("# deploy LBP using Manager", () => {
    describe("$ deploy LBP using Manager to test reverseArray() function", () => {
      let unsortedInitializeLBPManagerParams;
      beforeEach(async () => {
        fees = [SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_ZERO];
        const reverseTokenList = reverseArray(tokenAddresses);
        const reverseInitialBalance = reverseArray(INITIAL_BALANCES);
        const reverseWeights = reverseArray(START_WEIGHTS);
        const reverseEndWeights = reverseArray(END_WEIGHTS);

        unsortedInitializeLBPManagerParams = paramGenerator.initializeParams(
          lbpFactoryInstance.address,
          NAME,
          SYMBOL,
          reverseTokenList,
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
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };

        const initialState = {
          initializeLBPManagerParams: unsortedInitializeLBPManagerParams,
          fundingAmount,
        };

        ({ lbpManagerInstance } = await setupInitialState(
          contractInstances,
          initialState
        ));
      });
      it("» getSwapEnabled reverts when calling it before initialized LBP", async () => {
        await expect(lbpManagerInstance.getSwapEnabled()).to.be.revertedWith(
          "LBPManager: LBP not initialized."
        );
      });
      it("» success", async () => {
        await lbpManagerInstance.connect(admin).initializeLBP(admin.address);
        lbpInstance = lbpContractFactory.attach(await lbpManagerInstance.lbp());
        poolId = await lbpInstance.getPoolId();

        expect(await lbpManagerInstance.lbp()).not.equal(ZERO_ADDRESS);
      });
    });
    describe("$ deploy LBP using Manager succeeds with unsorted array", () => {
      beforeEach(async () => {
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };

        const initialState = {
          initializeLBPManagerParams,
          fundingAmount,
        };

        ({ lbpManagerInstance } = await setupInitialState(
          contractInstances,
          initialState
        ));
      });
      it("» success", async () => {
        await lbpManagerInstance.connect(admin).initializeLBP(admin.address);
        lbpInstance = lbpContractFactory.attach(await lbpManagerInstance.lbp());

        expect(await lbpManagerInstance.lbp()).not.equal(ZERO_ADDRESS);
      });
      it("» reverts when initializing LBP twice", async () => {
        await lbpManagerInstance.connect(admin).initializeLBP(admin.address);
        await expect(
          lbpManagerInstance.connect(admin).initializeLBP(admin.address)
        ).to.be.revertedWith("LBPManager: pool already funded");
      });
    });
  });
  describe("# transfers ownership of LBPManager", async () => {
    beforeEach(async () => {
      const initialState = {
        initializeLBPManagerParams,
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
      await expect(
        lbpManagerInstance.connect(owner).transferAdminRights(admin.address)
      )
        .to.emit(lbpManagerInstance, "LBPManagerAdminChanged")
        .withArgs(owner.address, admin.address);
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
          initializeLBPManagerParams,
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
        initializeLBPManagerParams = paramGenerator.initializeParams(
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
          initializeLBPManagerParams,
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
  describe("# initializeLBP with different feePercentage", () => {
    describe("$ adding liquidity with 5 percent fee", async () => {
      let amountToAddForFee;

      beforeEach(async () => {
        fees = [SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_FIVE];

        initializeLBPManagerParams = paramGenerator.initializeParams(
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
          initializeLBPManagerParams,
          fundingAmount,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success fee transferred", async () => {
        await expect(
          lbpManagerInstance.connect(admin).initializeLBP(admin.address)
        )
          .to.emit(lbpManagerInstance, "FeeTransferred")
          .withArgs(beneficiary.address, tokenAddresses[0], amountToAddForFee);
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

        expect(
          (
            await tokenInstances[PROJECT_TOKEN_INDEX].balanceOf(
              beneficiary.address
            )
          ).eq(0)
        ).to.be.true;

        // await expect(
        //   lbpManagerInstance.connect(admin).initializeLBP(admin.address)
        // ).to.emit(vaultInstance, eventName);

        const tx = await lbpManagerInstance
          .connect(admin)
          .initializeLBP(admin.address);
        const newLbpInstance = lbpContractFactory.attach(
          await lbpManagerInstance.lbp()
        );

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = filterPoolBalancesChangedEvent(
          receipt,
          vaultAddress,
          vaultInterface,
          eventName
        );

        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);
        const sortedAddress = sortAddresses(...tokenAddresses);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(sortedAddress[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(sortedAddress[1]);
        expect(
          (await newLbpInstance.balanceOf(lbpManagerInstance.address)).eq(0)
        ).to.be.false;
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

        initializeLBPManagerParams = paramGenerator.initializeParams(
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
          initializeLBPManagerParams,
          fundingAmount,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

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
          .initializeLBP(admin.address);

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = filterPoolBalancesChangedEvent(
          receipt,
          vaultAddress,
          vaultInterface,
          eventName
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);
        const sortedAddress = sortAddresses(...tokenAddresses);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(sortedAddress[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(sortedAddress[1]);
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
          initializeLBPManagerParams,
          fundingAmount,
        };
        ({ lbpManagerInstance, tokenInstances, amountToAddForFee } =
          await setupInitialState(contractInstances, initialState));
      });
      it("» success", async () => {
        const eventName = "PoolBalanceChanged";
        const { abi } = VaultArtifact;
        const vaultInterface = new ethers.utils.Interface(abi);

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
          .initializeLBP(admin.address);

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = filterPoolBalancesChangedEvent(
          receipt,
          vaultAddress,
          vaultInterface,
          eventName
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);
        const sortedAddress = sortAddresses(...tokenAddresses);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(sortedAddress[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(sortedAddress[1]);
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
    describe("$ adding liquidity with reverse tokenList and 5 percent fee", async () => {
      let amountToAddForFee;

      beforeEach(async () => {
        amountToAddForFee = BigNumber.from(0);

        // reverse START_weights and amounts
        const reverseInitialBalance = reverseArray(INITIAL_BALANCES);
        const reverseWeights = reverseArray(START_WEIGHTS);
        const reverseEndWeights = reverseArray(END_WEIGHTS);
        fees = [SWAP_FEE_PERCENTAGE, FEE_PERCENTAGE_FIVE];

        initializeLBPManagerParams = paramGenerator.initializeParams(
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
          initializeLBPManagerParams,
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

        // check balance of beneficiary before joinPool()
        expect((await tokenInstances[0].balanceOf(beneficiary.address)).eq(0))
          .to.be.true;

        const tx = await lbpManagerInstance
          .connect(admin)
          .initializeLBP(admin.address);

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = filterPoolBalancesChangedEvent(
          receipt,
          vaultAddress,
          vaultInterface,
          eventName
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);
        const sortedAddress = sortAddresses(...tokenAddresses);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(sortedAddress[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(sortedAddress[1]);
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
    describe("$ adding liquidity with reverse tokenList and 0 percent fee", async () => {
      let amountToAddForFee;

      beforeEach(async () => {
        amountToAddForFee = BigNumber.from(0);

        // reverse START_weights and amounts
        const reverseInitialBalance = reverseArray(INITIAL_BALANCES);
        const reverseWeights = reverseArray(START_WEIGHTS);
        const reverseEndWeights = reverseArray(END_WEIGHTS);

        initializeLBPManagerParams = paramGenerator.initializeParams(
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
          initializeLBPManagerParams,
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

        // check balance of beneficiary before joinPool()
        expect((await tokenInstances[0].balanceOf(beneficiary.address)).eq(0))
          .to.be.true;

        const tx = await lbpManagerInstance
          .connect(admin)
          .initializeLBP(admin.address);

        const receipt = await tx.wait();
        const vaultAddress = vaultInstance.address;
        const vaultEvent = filterPoolBalancesChangedEvent(
          receipt,
          vaultAddress,
          vaultInterface,
          eventName
        );
        const decodedVaultEvent = vaultInterface.parseLog(vaultEvent);
        const sortedAddress = sortAddresses(...tokenAddresses);

        expect(decodedVaultEvent.name).to.equal(eventName);
        expect(decodedVaultEvent.args[0]).to.equal(poolId);
        expect(decodedVaultEvent.args[1]).to.equal(lbpManagerInstance.address);
        expect(decodedVaultEvent.args[2][0]).to.equal(sortedAddress[0]);
        expect(decodedVaultEvent.args[2][1]).to.equal(sortedAddress[1]);
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
        initializeLBPManagerParams,
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
      expect(await lbpManagerInstance.getSwapEnabled()).to.equal(false);
    });
    it("» setSwapEnabled to true", async () => {
      expect(await lbpManagerInstance.admin()).to.equal(admin.address);
      await lbpManagerInstance.connect(admin).setSwapEnabled(true);
      expect(await lbpManagerInstance.getSwapEnabled()).to.equal(true);
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
          initializeLBPManagerParams,
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
          initializeLBPManagerParams,
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
        await time.increase(1100);
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
          initializeLBPManagerParams,
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
    describe("$ update metadata", () => {
      let newMetadata;
      beforeEach(async () => {
        newMetadata = "0x";
        const fundingAmount = {
          initialBalances: INITIAL_BALANCES,
          feePercentage: FEE_PERCENTAGE_ZERO,
        };
        const initialState = {
          initializeLBPManagerParams,
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
      it("» revert on not called by owner", async () => {
        await expect(
          lbpManagerInstance.updateMetadata(newMetadata)
        ).to.be.revertedWith("LBPManager: caller is not admin");
      });
      it("» succes on updating metadata", async () => {
        await expect(
          lbpManagerInstance.connect(admin).updateMetadata(newMetadata)
        )
          .to.emit(lbpManagerInstance, "MetadataUpdated")
          .withArgs(newMetadata);
        expect(await lbpManagerInstance.metadata()).to.equal(newMetadata);
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
          initializeLBPManagerParams,
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
        await time.increase(1100);
        // check balance before withdrawing pool tokens
        const balance = await lbpContractInstance.balanceOf(
          lbpManagerInstance.address
        );
        await expect(
          lbpManagerInstance.connect(admin).withdrawPoolTokens(admin.address)
        )
          .to.emit(lbpManagerInstance, "PoolTokensWithdrawn")
          .withArgs(lbpInstance.address, balance);
        expect(await lbpContractInstance.balanceOf(admin.address)).to.equal(
          balance
        );
      });
      it("» reverts when withdrawing again", async () => {
        await time.increase(1100);
        await lbpManagerInstance
          .connect(admin)
          .withdrawPoolTokens(admin.address);
        await expect(
          lbpManagerInstance.connect(admin).withdrawPoolTokens(admin.address)
        ).to.be.revertedWith("LBPManager: no BPT token balance");
      });
      it("» reverts when trying to remove liquidity after withdrawing pool tokens", async () => {
        await time.increase(1100);
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
