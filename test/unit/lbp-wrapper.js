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

  return { lbpWrapperInstance, tokenInstances, amountToAddForFee };
};

describe(">> Contract: LBPWrapper", () => {
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
  const ZERO_AMOUNT_ARRAY = [0, 0];
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
      ).to.be.revertedWith("LBPWrapper: new admin cannot be zero");
    });
    it("» success", async () => {
      await lbpWrapperInstance
        .connect(owner)
        .transferAdminRights(admin.address);
      expect(await lbpWrapperInstance.admin()).to.equal(admin.address);
    });
  });
  // describe("# retrieve tokens through retrieveProjectAndFundingToken", () => {
  //   describe("$ invalid retrieveProjectAndFundingToken call", () => {
  //     beforeEach(async () => {
  //       const funds = {
  //         initialBalances: INITIAL_BALANCES,
  //         primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_FIVE,
  //       };
  //       const initialState = {
  //         initializeLBPParams,
  //         OwnerAdmin: true,
  //         funds,
  //       };
  //       ({ lbpWrapperInstance, tokenInstances } = await setupInitialState(
  //         contractInstances,
  //         initialState
  //       ));
  //     });
  //     it("» reverts when not called by admin", async () => {
  //       await expect(
  //         lbpWrapperInstance.retrieveProjectAndFundingToken(receiver.address)
  //       ).to.be.revertedWith("LBPWrapper: only admin function");
  //     });
  //     it("» reverts when receiver address is zero", async () => {
  //       await expect(
  //         lbpWrapperInstance
  //           .connect(admin)
  //           .retrieveProjectAndFundingToken(ZERO_ADDRESS)
  //       ).to.be.revertedWith(
  //         "LBPWrapper: receiver of project and funding tokens can't be zero"
  //       );
  //     });
  //     it("» retrieves back the funds to admin", async () => {
  //       // expect(
  //       //   await tokenInstances[0].balanceOf(lbpWrapperInstance.address)
  //       // ).to.equal(INITIAL_BALANCES[0]);
  //       // expect(
  //       //   await tokenInstances[1].balanceOf(lbpWrapperInstance.address)
  //       // ).to.equal(INITIAL_BALANCES[1]);

  //       await lbpWrapperInstance
  //         .connect(admin)
  //         .retrieveProjectAndFundingToken(receiver.address);
  //       console.log(
  //         (await tokenInstances[0].balanceOf(receiver.address)).toString()
  //       );
  //       expect(await tokenInstances[0].balanceOf(receiver.address)).to.equal(
  //         INITIAL_BALANCES[0]
  //       );
  //       expect(await tokenInstances[1].balanceOf(receiver.address)).to.equal(
  //         INITIAL_BALANCES[1]
  //       );
  //     });
  //   });
  //   describe("$ valid retrieveProjectAndFundingToken call", () => {
  //     beforeEach(async () => {
  //       // const funds = {
  //       //   initialBalances: INITIAL_BALANCES,
  //       //   primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_FIVE,
  //       // };
  //       const initialState = {
  //         initializeLBPParams,
  //         OwnerAdmin: true,
  //         // funds,
  //       };
  //       ({ lbpWrapperInstance, tokenInstances } = await setupInitialState(
  //         contractInstances,
  //         initialState
  //       ));
  //     });
  //     it("» retrieves back the funds to admin", async () => {
  //       await tokenInstances[0]
  //         .connect(admin)
  //         .transfer(lbpWrapperInstance.address, INITIAL_BALANCES[0].toString());
  //       await tokenInstances[1]
  //         .connect(admin)
  //         .transfer(lbpWrapperInstance.address, INITIAL_BALANCES[1].toString());

  //       expect(
  //         await tokenInstances[0].balanceOf(lbpWrapperInstance.address)
  //       ).to.equal(INITIAL_BALANCES[0]);
  //       expect(
  //         await tokenInstances[1].balanceOf(lbpWrapperInstance.address)
  //       ).to.equal(INITIAL_BALANCES[1]);

  //       await lbpWrapperInstance
  //         .connect(admin)
  //         .retrieveProjectAndFundingToken(receiver.address);
  //       expect(await tokenInstances[0].balanceOf(receiver.address)).to.equal(
  //         INITIAL_BALANCES[0]
  //       );
  //       expect(await tokenInstances[1].balanceOf(receiver.address)).to.equal(
  //         INITIAL_BALANCES[1]
  //       );
  //     });
  //   });
  //   describe("$ try retrieve funds after call fundPool", () => {
  //     let userData;
  //     beforeEach(async () => {
  //       userData = ethers.utils.defaultAbiCoder.encode(
  //         ["uint256", "uint256[]"],
  //         [JOIN_KIND_INIT, INITIAL_BALANCES]
  //       );
  //       // Specifies funds and fee to be sent to setpInitialState
  //       const funds = {
  //         initialBalances: INITIAL_BALANCES,
  //         primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_FIVE,
  //       };
  //       const initialState = {
  //         initializeLBPParams,
  //         OwnerAdmin: true,
  //         funds,
  //         userData,
  //       };
  //       ({ lbpWrapperInstance, tokenInstances } = await setupInitialState(
  //         contractInstances,
  //         initialState
  //       ));
  //     });
  //     it("» reverts tokens are in the pool", async () => {
  //       console.log(await lbpWrapperInstance.poolFunded());
  //       console.log(
  //         (
  //           await tokenInstances[0].allowance(
  //             admin.address,
  //             lbpWrapperInstance.address
  //           )
  //         ).toString()
  //       );
  //       await lbpWrapperInstance
  //         .connect(admin)
  //         .retrieveProjectAndFundingToken(receiver.address);
  //     });
  //   });
  // });
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
        // userData = ethers.utils.defaultAbiCoder.encode(
        //   ["uint256", "uint256[]"],
        //   [JOIN_KIND_INIT, INITIAL_BALANCES]
        // );
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
        // initializeLBPParams = paramGenerator.initializeParams(
        //   lbpFactoryInstance.address,
        //   NAME,
        //   SYMBOL,
        //   tokenAddresses,
        //   INITIAL_BALANCES,
        //   WEIGHTS,
        //   startTime,
        //   endTime,
        //   END_WEIGHTS,
        //   SWAP_FEE_PERCENTAGE,
        //   PRIME_DAO_FEE_PERCENTAGE_FIVE,
        //   beneficiary.address
        // );

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
        // await tokenInstances[0]
        //   .connect(owner)
        //   .transfer(admin.address, INITIAL_BALANCES[0].mul(2).toString());
        // await tokenInstances[1]
        //   .connect(owner)
        //   .transfer(admin.address, INITIAL_BALANCES[1].mul(2).toString());

        // await tokenInstances[0]
        //   .connect(admin)
        //   .approve(
        //     lbpWrapperInstance.address,
        //     INITIAL_BALANCES[0].mul(2).toString()
        //   );
        // await tokenInstances[1]
        //   .connect(admin)
        //   .approve(
        //     lbpWrapperInstance.address,
        //     INITIAL_BALANCES[1].mul(2).toString()
        //   );
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
        expect(
          (await tokenInstances[0].balanceOf(beneficiary.address)).eq(
            amountToAddForFee || 0
          )
        ).to.be.true;
      });
      it("» revert when adding liquidity more then once", async () => {
        // adding initial liquidity
        await lbpWrapperInstance
          .connect(admin)
          .fundPool(
            tokenAddresses,
            admin.address,
            FROM_INTERNAL_BALANCE,
            userData
          );
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
    it("» revert on being called by not the owner", async () => {
      await expect(
        lbpWrapperInstance.connect(owner).setSwapEnabled(false)
      ).to.be.revertedWith("LBPWrapper: only admin function");
    });
    it("» pauses the LBP", async () => {
      expect(await lbpWrapperInstance.admin()).to.equal(admin.address);
      await lbpWrapperInstance.connect(admin).setSwapEnabled(false);
      expect(await lbpInstance.getSwapEnabled()).to.be.false;
    });
  });
  context(">> exit pool", async () => {
    let exitUserData;
    let poolFunded;
    let lbpContractInstance;
    beforeEach(async () => {
      poolFunded = true;

      // Specifies funds and fee to be sent to setpInitialState
      const fundingAmount = {
        initialBalances: INITIAL_BALANCES,
        primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_FIVE,
      };
      const initialState = {
        initializeLBPParams,
        OwnerAdmin: true,
        fundingAmount,
        poolFunded,
      };
      ({ lbpWrapperInstance, tokenInstances } = await setupInitialState(
        contractInstances,
        initialState
      ));
      lbpContractInstance = await lbpContractFactory.attach(
        await lbpWrapperInstance.lbp()
      );
      tokenAddresses = tokenInstances.map((token) => token.address);
      const balance = await lbpContractInstance.balanceOf(
        lbpWrapperInstance.address
      );
      exitUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [EXIT_KIND, balance.toString()]
      );
    });
    it(">> reverts when trying to remove liquidity where receiver address is zero address", async () => {
      await expect(
        lbpWrapperInstance
          .connect(admin)
          .removeLiquidity(
            tokenAddresses,
            ZERO_ADDRESS,
            ZERO_AMOUNT_ARRAY,
            false,
            exitUserData
          )
      ).to.be.revertedWith(
        "LBPWrapper: receiver of project and funding tokens can't be zero"
      );
    });
    it(">> reverts when trying to remove liquidity before endTime", async () => {
      await expect(
        lbpWrapperInstance
          .connect(admin)
          .removeLiquidity(
            tokenAddresses,
            admin.address,
            ZERO_AMOUNT_ARRAY,
            false,
            exitUserData
          )
      ).to.be.revertedWith("LBPWrapper: cannot remove liqudity from the pool before endtime");
    });
    it(">> exits or remove liquidity after endTime", async () => {
      await time.increase(1000);
      const { balances: poolBalances } = await vaultInstance.getPoolTokens(
        await lbpContractInstance.getPoolId()
      );
      await lbpWrapperInstance
        .connect(admin)
        .removeLiquidity(
          tokenAddresses,
          admin.address,
          ZERO_AMOUNT_ARRAY,
          false,
          exitUserData
        );
      const { balances: poolBalancesAfterExit } =
        await vaultInstance.getPoolTokens(
          await lbpContractInstance.getPoolId()
        );
      expect(
        (await lbpContractInstance.balanceOf(lbpWrapperInstance.address)).eq(0)
      ).to.be.true;
      for (let i = 0; i < poolBalances.length; i++) {
        expect(poolBalances[i].gt(poolBalancesAfterExit[i])).to.be.true;
      }
    });
  });
  context(">> withdraw pool tokens", async () => {
    let exitUserData;
    let poolFunded;
    let lbpContractInstance;
    beforeEach(async () => {
      poolFunded = true;

      // Specifies funds and fee to be sent to setpInitialState
      const fundingAmount = {
        initialBalances: INITIAL_BALANCES,
        primeDaoFeePercentage: PRIME_DAO_FEE_PERCENTAGE_FIVE,
      };
      const initialState = {
        initializeLBPParams,
        OwnerAdmin: true,
        fundingAmount,
        poolFunded,
      };
      ({ lbpWrapperInstance, tokenInstances } = await setupInitialState(
        contractInstances,
        initialState
      ));
      lbpContractInstance = await lbpContractFactory.attach(
        await lbpWrapperInstance.lbp()
      );
      tokenAddresses = tokenInstances.map((token) => token.address);
      const balance = await lbpContractInstance.balanceOf(
        lbpWrapperInstance.address
      );
      exitUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [EXIT_KIND, balance.toString()]
      );
    });
    it(">> reverts when receiver address is zero address", async () => {
      await expect(
        lbpWrapperInstance.connect(admin).withdrawPoolTokens(ZERO_ADDRESS)
      ).to.be.revertedWith("LBPWrapper: receiver of pool tokens can't be zero");
    });
    it(">> reverts when trying to withdraw before end time", async () => {
      await expect(
        lbpWrapperInstance.connect(admin).withdrawPoolTokens(admin.address)
      ).to.be.revertedWith("LBPWrapper: cannot withdraw pool tokens before endtime");
    });
    it(">> withdraw pool tokens", async () => {
      await time.increase(1000);
      const balance = await lbpContractInstance.balanceOf(
        lbpWrapperInstance.address
      );
      await lbpWrapperInstance.connect(admin).withdrawPoolTokens(admin.address);
      expect((await lbpContractInstance.balanceOf(admin.address)).eq(balance))
        .to.be.true;
    });
    it(">> reverts when withdrawing again", async () => {
      await time.increase(1000);
      await lbpWrapperInstance.connect(admin).withdrawPoolTokens(admin.address);
      await expect(
        lbpWrapperInstance.connect(admin).withdrawPoolTokens(admin.address)
      ).to.be.revertedWith("LBPWrapper: wrapper dosen't have any pool tokens to withdraw");
    });
    it(">> reverts when trying to remove liquidity after withdrawing pool tokens", async () => {
      await time.increase(1000);
      await lbpWrapperInstance.connect(admin).withdrawPoolTokens(admin.address);
      await expect(
        lbpWrapperInstance
          .connect(admin)
          .removeLiquidity(
            tokenAddresses,
            admin.address,
            ZERO_AMOUNT_ARRAY,
            false,
            exitUserData
          )
      ).to.be.revertedWith("LBPWrapper: wrapper dosen't have any pool tokens to remove liquidity");
    });
  });
});
