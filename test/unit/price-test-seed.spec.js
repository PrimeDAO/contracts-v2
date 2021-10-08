const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, expectRevert, BN } = require("@openzeppelin/test-helpers");
const { parseEther, parseUnits } = ethers.utils;

const init = require("../test-init.js");
const { BigNumber } = require("@ethersproject/bignumber");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.seed = await init.getContractInstance("Seed", setup.roles.prime);

  setup.token = await init.gettokenInstances(setup);

  setup.data = {};

  return setup;
};

describe("Contract: Seed", async () => {
  let setup;
  let root;
  let admin;
  let buyer1;
  let buyer2;
  let buyer3;
  let buyer4;
  let seedToken;
  let fundingToken;
  let tokenWithSixDecimal;
  let softCap;
  let hardCap;
  let price;
  let buyAmount;
  let smallBuyAmount;
  let buySeedAmount;
  let buySeedFee;
  let startTime;
  let endTime;
  let vestingDuration;
  let vestingCliff;
  let permissionedSeed;
  let fee;
  let seed;
  let metadata;
  let seedForDistribution;
  let seedForFee;
  let requiredSeedAmount;
  let claimAmount;
  let feeAmount;
  let totalClaimedByBuyer1;
  let seedAmount;
  let feeAmountOnClaim;

  // constants
  const zero = 0;
  const one = 1;
  const hundred = 100;
  const tenETH = parseEther("10").toString();
  const hundredTwoETH = parseEther("102").toString();
  const twoHundredFourETH = parseEther("204").toString();
  const hundredBn = new BN(100);
  const twoBN = new BN(2);
  const PRECISION = ethers.constants.WeiPerEther;
  const ninetyTwoDaysInSeconds = time.duration.days(92);
  const eightyNineDaysInSeconds = time.duration.days(89);
  const tenDaysInSeconds = time.duration.days(10);

  context("» price test of token with decimals 18", () => {
    before("!! setup", async () => {
      setup = await deploy();

      // Tokens used
      fundingToken = setup.token.fundingToken;
      seedToken = setup.token.seedToken;
      const CustomDecimalERC20Mock = await ethers.getContractFactory(
        "CustomDecimalERC20Mock",
        setup.roles.prime
      );
      tokenWithSixDecimal = await CustomDecimalERC20Mock.deploy(
        "USDC",
        "USDC",
        6
      );

      // // Roles
      root = setup.roles.root;
      beneficiary = setup.roles.beneficiary;
      admin = setup.roles.prime;
      buyer1 = setup.roles.buyer1;
      buyer2 = setup.roles.buyer2;
      buyer3 = setup.roles.buyer3;

      // // Parameters to initialize seed contract
      softCap = parseEther("10").toString();
      hardCap = parseEther("102").toString();
      buyAmount = parseEther("51").toString();
      smallBuyAmount = parseEther("9").toString();
      buySeedAmount = parseEther("5100").toString();
      price = parseEther("1").toString();
      startTime = await time.latest();
      endTime = await startTime.add(await time.duration.days(7));
      vestingDuration = time.duration.days(365); // 1 year
      vestingCliff = time.duration.days(90); // 3 months
      permissionedSeed = false;
      fee = parseEther("0.02").toString(); // 2%
      metadata = `0x`;

      buySeedFee = new BN(buySeedAmount)
        .mul(new BN(fee))
        .div(new BN(PRECISION.toString()));
      seedForDistribution = new BN(hardCap)
        .div(new BN(price))
        .mul(new BN(PRECISION.toString()));
      seedForFee = seedForDistribution
        .mul(new BN(fee))
        .div(new BN(PRECISION.toString()));
      requiredSeedAmount = seedForDistribution.add(seedForFee);

      await setup.seed.initialize(
        beneficiary.address,
        admin.address,
        [seedToken.address, fundingToken.address],
        [softCap, hardCap],
        price,
        startTime.toNumber(),
        endTime.toNumber(),
        vestingDuration.toNumber(),
        vestingCliff.toNumber(),
        permissionedSeed,
        fee
      );
      await fundingToken.connect(root).transfer(buyer1.address, hundredTwoETH);
      await fundingToken
        .connect(buyer1)
        .approve(setup.seed.address, hundredTwoETH);

      claimAmount = new BN(ninetyTwoDaysInSeconds).mul(
        new BN(buySeedAmount).mul(new BN(twoBN)).div(new BN(vestingDuration))
      );
      feeAmount = new BN(claimAmount)
        .mul(new BN(fee))
        .div(new BN(PRECISION.toString()));
      await seedToken
        .connect(root)
        .transfer(setup.seed.address, requiredSeedAmount.toString());
    });
    it("$ buys with one funding token", async () => {
        const oneFundingTokenAmount = parseUnits('1', (await fundingToken.decimals()).toString());
        await fundingToken.connect(buyer1).approve(setup.seed.address, oneFundingTokenAmount);
        await setup.seed.connect(buyer1).buy(oneFundingTokenAmount);
        const expectedSeedAmount = oneFundingTokenAmount.mul(PRECISION).div(BigNumber.from(price));
        expect(
            (await setup.seed.seedAmountForFunder(buyer1.address)).eq(expectedSeedAmount)
        ).to.be.true;
    });
  });
  context("» price test of tokens with decimals 6", () => {
    before("!! setup", async () => {
      setup = await deploy();

      // Tokens used
      fundingToken = setup.token.fundingToken;
      seedToken = setup.token.seedToken;
      const CustomDecimalERC20Mock = await ethers.getContractFactory(
        "CustomDecimalERC20Mock",
        setup.roles.prime
      );
      tokenWithSixDecimal = await CustomDecimalERC20Mock.deploy(
        "USDC",
        "USDC",
        6
      );

      // // Roles
      root = setup.roles.root;
      beneficiary = setup.roles.beneficiary;
      admin = setup.roles.prime;
      buyer1 = setup.roles.buyer1;
      buyer2 = setup.roles.buyer2;
      buyer3 = setup.roles.buyer3;

      // // Parameters to initialize seed contract
      softCap = parseUnits("10",(await tokenWithSixDecimal.decimals()).toString()).toString();
      hardCap = parseUnits("102",(await tokenWithSixDecimal.decimals()).toString()).toString();
      buyAmount = parseUnits("51", (await tokenWithSixDecimal.decimals()).toString()).toString();
      smallBuyAmount = parseUnits("9", (await tokenWithSixDecimal.decimals()).toString()).toString();
      buySeedAmount = parseEther("5100").toString();
      price = parseUnits("1", (await tokenWithSixDecimal.decimals()).toString() ).toString();
      startTime = await time.latest();
      endTime = await startTime.add(await time.duration.days(7));
      vestingDuration = time.duration.days(365); // 1 year
      vestingCliff = time.duration.days(90); // 3 months
      permissionedSeed = false;
      fee = parseEther("0.02").toString(); // 2%
      metadata = `0x`;

      buySeedFee = new BN(buySeedAmount)
        .mul(new BN(fee))
        .div(new BN(PRECISION.toString()));
      seedForDistribution = new BN(hardCap)
        .mul(new BN(PRECISION.toString()))
        .div(new BN(price));
      seedForFee = seedForDistribution
        .mul(new BN(fee))
        .div(new BN(PRECISION.toString()));
      requiredSeedAmount = seedForDistribution.add(seedForFee);

      await setup.seed.initialize(
        beneficiary.address,
        admin.address,
        [seedToken.address, tokenWithSixDecimal.address],
        [softCap, hardCap],
        price,
        startTime.toNumber(),
        endTime.toNumber(),
        vestingDuration.toNumber(),
        vestingCliff.toNumber(),
        permissionedSeed,
        fee
      );
      await tokenWithSixDecimal.connect(root).transfer(buyer1.address, hundredTwoETH);
      await tokenWithSixDecimal
        .connect(buyer1)
        .approve(setup.seed.address, hundredTwoETH);

      claimAmount = new BN(ninetyTwoDaysInSeconds).mul(
        new BN(buySeedAmount).mul(new BN(twoBN)).div(new BN(vestingDuration))
      );
      feeAmount = new BN(claimAmount)
        .mul(new BN(fee))
        .div(new BN(PRECISION.toString()));
      await seedToken
        .connect(root)
        .transfer(setup.seed.address, requiredSeedAmount.toString());
    });
    it("$ buys with one funding token", async () => {
        const oneFundingTokenAmount = parseUnits('1', (await tokenWithSixDecimal.decimals()).toString());
        await tokenWithSixDecimal.connect(buyer1).approve(setup.seed.address, oneFundingTokenAmount);
        await setup.seed.connect(buyer1).buy(oneFundingTokenAmount);
        const expectedSeedAmount = oneFundingTokenAmount.mul(PRECISION).div(BigNumber.from(price));
        expect(
            (await setup.seed.seedAmountForFunder(buyer1.address)).eq(expectedSeedAmount)
        ).to.be.true;
    });
  });
});
