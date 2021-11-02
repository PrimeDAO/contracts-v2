const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, expectRevert, BN } = require("@openzeppelin/test-helpers");
const {
  utils: { parseEther, parseUnits },
  BigNumber,
} = ethers;

const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.seed = await init.getContractInstance("Seed", setup.roles.prime);

  setup.token = await init.gettokenInstances(setup);

  setup.data = {};

  return setup;
};

const getDecimals = async (token) => await token.decimals();

const getTokenAmount = (tokenDecimal) => (amount) =>
  parseUnits(amount, tokenDecimal.toString());

describe("Contract: Seed", async () => {
  let setup;
  let root;
  let admin;
  let buyer1;
  let buyer2;
  let buyer3;
  let buyer4;
  let seedToken;
  let seedTokenDecimal;
  let getSeedAmounts;
  let fundingToken;
  let fundingTokenDecimal;
  let getFundingAmounts;
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

  context("» creator is avatar", () => {
    before("!! setup", async () => {
      setup = await deploy();

      const CustomDecimalERC20Mock = await ethers.getContractFactory(
        "CustomDecimalERC20Mock",
        setup.roles.root
      );

      // Tokens used
      // fundingToken = setup.token.fundingToken;
      fundingToken = await CustomDecimalERC20Mock.deploy("USDC", "USDC", 16);
      fundingTokenDecimal = (await getDecimals(fundingToken)).toString();
      getFundingAmounts = getTokenAmount(fundingTokenDecimal);

      // seedToken = setup.token.seedToken;
      seedToken = await CustomDecimalERC20Mock.deploy("Prime", "Prime", 12);
      seedTokenDecimal = (await getDecimals(seedToken)).toString();
      getSeedAmounts = getTokenAmount(seedTokenDecimal);

      // // Roles
      root = setup.roles.root;
      beneficiary = setup.roles.beneficiary;
      admin = setup.roles.prime;
      buyer1 = setup.roles.buyer1;
      buyer2 = setup.roles.buyer2;
      buyer3 = setup.roles.buyer3;

      // // Parameters to initialize seed contract
      softCap = getFundingAmounts("10").toString();
      hardCap = getFundingAmounts("102").toString();
      price = parseUnits(
        "0.01",
        parseInt(fundingTokenDecimal) - parseInt(seedTokenDecimal) + 18
      ).toString();
      buyAmount = getFundingAmounts("51").toString();
      smallBuyAmount = getFundingAmounts("9").toString();
      buySeedAmount = getSeedAmounts("5100").toString();
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
    });
    context("» contract is not initialized yet", () => {
      context("» parameters are valid", () => {
        context("» distribution period not yet started", () => {
          it("is not possible to buy", async () => {
            const alternativeSetup = await deploy();
            await alternativeSetup.seed.initialize(
              beneficiary.address,
              admin.address,
              [seedToken.address, fundingToken.address],
              [softCap, hardCap],
              price,
              (await startTime.add(await time.duration.days(2))).toNumber(),
              endTime.toNumber(),
              vestingDuration.toNumber(),
              vestingCliff.toNumber(),
              permissionedSeed,
              fee
            );
            const signers = await ethers.getSigners();
            const randomSigner = signers[9];
            await expectRevert(
              alternativeSetup.seed
                .connect(randomSigner)
                .buy(getFundingAmounts("1").add(buyAmount)),
              "Seed: only allowed during distribution period"
            );
          });
        });

        it("it initializes seed", async () => {
          // emulate creation & initialization via seedfactory & fund with seedTokens

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

          expect(await setup.seed.initialized()).to.equal(true);
          expect(await setup.seed.beneficiary()).to.equal(beneficiary.address);
          expect(await setup.seed.admin()).to.equal(admin.address);
          expect(await setup.seed.seedToken()).to.equal(seedToken.address);
          expect(await setup.seed.fundingToken()).to.equal(
            fundingToken.address
          );
          expect((await setup.seed.softCap()).toString()).to.equal(
            softCap.toString()
          );
          expect((await setup.seed.price()).toString()).to.equal(
            price.toString()
          );
          expect(await setup.seed.permissionedSeed()).to.equal(
            permissionedSeed
          );
          expect((await setup.seed.fee()).toString()).to.equal(fee.toString());
          expect(await setup.seed.closed()).to.equal(false);
          expect((await setup.seed.seedAmountRequired()).toString()).to.equal(
            seedForDistribution.toString()
          );
          expect((await setup.seed.feeAmountRequired()).toString()).to.equal(
            seedForFee.toString()
          );
          expect((await setup.seed.seedRemainder()).toString()).to.equal(
            seedForDistribution.toString()
          );
          expect((await setup.seed.feeRemainder()).toString()).to.equal(
            seedForFee.toString()
          );
          expect((await setup.seed.isFunded()).toString()).to.equal("false");
        });
        it("it reverts on double initialization", async () => {
          await expectRevert(
            setup.seed.initialize(
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
            ),
            "Seed: contract already initialized"
          );
        });
        it("reverts when trying to add/remove whitelist", async () => {
          await expectRevert(
            setup.seed
              .connect(admin)
              .whitelistBatch([buyer1.address, buyer2.address]),
            "Seed: seed is not whitelisted"
          );
          await expectRevert(
            setup.seed.connect(admin).unwhitelist(buyer1.address),
            "Seed: seed is not whitelisted"
          );
        });
      });
    });
    context("# buy", () => {
      context("» generics", () => {
        before("!! top up buyer1 balance", async () => {
          await fundingToken
            .connect(root)
            .transfer(buyer1.address, getFundingAmounts("102"));
          await fundingToken
            .connect(buyer1)
            .approve(setup.seed.address, getFundingAmounts("102"));

          claimAmount = new BN(ninetyTwoDaysInSeconds).mul(
            new BN(buySeedAmount)
              .mul(new BN(twoBN))
              .div(new BN(vestingDuration))
          );
          feeAmount = new BN(claimAmount)
            .mul(new BN(fee))
            .div(new BN(PRECISION.toString()));
        });
        it("it cannot buy if not funded", async () => {
          await expectRevert(
            setup.seed.connect(buyer1).buy(buyAmount),
            "Seed: sufficient seeds not provided"
          );
        });
        it("it funds the Seed contract with Seed Token", async () => {
          await seedToken
            .connect(root)
            .transfer(setup.seed.address, requiredSeedAmount.toString());
          expect(
            (await seedToken.balanceOf(setup.seed.address)).toString()
          ).to.equal(requiredSeedAmount.toString());
        });
        it("it cannot buy when paused", async () => {
          await setup.seed.connect(admin).pause();
          await expectRevert(
            setup.seed.connect(buyer1).buy(buyAmount),
            "Seed: should not be paused"
          );
          await setup.seed.connect(admin).unpause();
        });
        it("it cannot buy 0 seeds", async () => {
          await expectRevert(
            setup.seed.connect(buyer1).buy(zero.toString()),
            "Seed: amountVestedPerSecond > 0"
          );
        });
        it("it buys tokens ", async () => {
          // seedAmount = (buyAmountt*PRECISION)/price;
          seedAmount = new BN(buyAmount)
            .mul(new BN(PRECISION.toString()))
            .div(new BN(price));

          await expect(setup.seed.connect(buyer1).buy(buyAmount))
            .to.emit(setup.seed, "SeedsPurchased")
            .withArgs(buyer1.address, seedAmount);
          expect(
            (await fundingToken.balanceOf(setup.seed.address)).toString()
          ).to.equal(
            Math.floor((buySeedAmount * price) / PRECISION).toString()
          );
        });
        it("cannot buy more than maximum target", async () => {
          await expectRevert(
            setup.seed
              .connect(buyer1)
              .buy(getFundingAmounts("1").add(buyAmount)),
            "Seed: amount exceeds contract sale hardCap"
          );
        });
        it("minimumReached == true", async () => {
          expect(await setup.seed.minimumReached()).to.equal(true);
        });
        it("it returns amount of seed token bought and the fee", async () => {
          let { ["0"]: seedAmount, ["1"]: feeAmount } = await setup.seed
            .connect(buyer1)
            .callStatic.buy(buyAmount);
          expect((await seedAmount).toString()).to.equal(buySeedAmount);
          expect((await feeAmount).toString()).to.equal(getSeedAmounts("102"));
        });
        it("updates fee mapping for locker", async () => {
          // get funding amount to calculate fee
          expect(
            (await setup.seed.feeForFunder(buyer1.address)).toString()
          ).to.equal(getSeedAmounts("102"));
        });
        it("updates the remaining seeds to distribution", async () => {
          expect((await setup.seed.seedRemainder()).toString()).to.equal(
            seedForDistribution.sub(new BN(buySeedAmount)).toString()
          );
        });
        it("updates the remaining seeds for fee", async () => {
          expect((await setup.seed.feeRemainder()).toString()).to.equal(
            seedForFee.sub(new BN(buySeedFee)).toString()
          );
        });
        it("updates the amount of funding token collected", async () => {
          expect((await setup.seed.fundingCollected()).toString()).to.equal(
            buyAmount.toString()
          );
        });
        it("it fails on claiming seed tokens if the distribution has not yet finished", async () => {
          await expectRevert(
            setup.seed
              .connect(buyer1)
              .claim(buyer1.address, claimAmount.toString()),
            "Seed: the distribution has not yet finished"
          );
        });
        it("it returns 0 when calculating claim before vesting starts", async () => {
          expect(
            (await setup.seed.calculateClaim(buyer1.address)).toString()
          ).to.equal("0");
        });
        it("updates lock when it buys tokens", async () => {
          // seedAmount = (buyAmountt*PRECISION)/price;
          seedAmount = new BN(buyAmount)
            .mul(new BN(PRECISION.toString()))
            .div(new BN(price));

          // get fundingAmount to calculate seedAmount
          let prevSeedAmount = await setup.seed.seedAmountForFunder(
            buyer1.address
          );
          // get funding amount to calculate fee
          let prevFeeAmount = await setup.seed.feeForFunder(buyer1.address);

          await expect(setup.seed.connect(buyer1).buy(buyAmount))
            .to.emit(setup.seed, "SeedsPurchased")
            .withArgs(buyer1.address, seedAmount);

          expect(
            (await fundingToken.balanceOf(setup.seed.address)).toString()
          ).to.equal((2 * buyAmount).toString());

          // get fundingAmount to calculate seedAmount
          expect(
            (await setup.seed.seedAmountForFunder(buyer1.address)).toString()
          ).to.equal(prevSeedAmount.mul(twoBN.toNumber()).toString());
          // get fundingAmount to calculate fee
          expect(
            (await setup.seed.feeForFunder(buyer1.address)).toString()
          ).to.equal(prevFeeAmount.mul(twoBN.toNumber()).toString());
        });
        it("maximumReached == true", async () => {
          expect(await setup.seed.maximumReached()).to.equal(true);
        });
        it("vestingStartTime == current timestamp", async () => {
          expect((await setup.seed.vestingStartTime()).toString()).to.equal(
            (await time.latest()).toString()
          );
        });
        it("updates the remaining seeds to distribution after another buy", async () => {
          expect((await setup.seed.seedRemainder()).toString()).to.equal(
            seedForDistribution.sub(new BN(buySeedAmount).mul(twoBN)).toString()
          );
        });
        it("updates the remaining seeds for fee after another buy", async () => {
          expect((await setup.seed.feeRemainder()).toString()).to.equal(
            seedForFee.sub(new BN(buySeedFee).mul(twoBN)).toString()
          );
        });
        it("return totalClaimed == 0", async () => {
          expect(
            (await setup.seed.funders(buyer1.address)).totalClaimed.toString()
          ).to.equal(zero.toString());
        });
        context("» ERC20 transfer fails", () => {
          it("reverts 'Seed: funding token transferFrom failed' ", async () => {
            const alternativeSetup = await deploy();
            const CustomERC20MockFactory = await ethers.getContractFactory(
              "CustomERC20Mock",
              setup.roles.prime
            );
            const alternativeFundingToken = await CustomERC20MockFactory.deploy(
              "DAI Stablecoin",
              "DAI"
            );
            const fundingTokenDecimal = await getDecimals(
              alternativeFundingToken
            );
            const getFundingAmounts = getTokenAmount(fundingTokenDecimal);
            const softCap = getFundingAmounts("10").toString();
            const hardCap = getFundingAmounts("102").toString();
            const price = parseUnits(
              "0.01",
              parseInt(fundingTokenDecimal) - parseInt(seedTokenDecimal) + 18
            ).toString();
            await alternativeSetup.seed.initialize(
              beneficiary.address,
              admin.address,
              [seedToken.address, alternativeFundingToken.address],
              [softCap, hardCap],
              price,
              startTime.toNumber(),
              endTime.toNumber(),
              vestingDuration.toNumber(),
              vestingCliff.toNumber(),
              permissionedSeed,
              fee
            );
            const requiredAmount = (
              await alternativeSetup.seed.seedAmountRequired()
            ).add(await alternativeSetup.seed.feeAmountRequired());
            await alternativeFundingToken
              .connect(root)
              .transfer(buyer1.address, hundredTwoETH);
            await seedToken
              .connect(root)
              .transfer(
                alternativeSetup.seed.address,
                requiredAmount.toString()
              );
            await expectRevert(
              alternativeSetup.seed.connect(buyer1).buy(getFundingAmounts("5")),
              "Seed: funding token transferFrom failed"
            );
          });
        });
      });
    });
    context("# claim", () => {
      context("» softCap not reached", () => {
        let alternativeSetup;

        beforeEach(async () => {
          alternativeSetup = await deploy();

          await alternativeSetup.seed.initialize(
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
          await fundingToken
            .connect(root)
            .transfer(buyer1.address, getFundingAmounts("102"));
          await fundingToken
            .connect(buyer1)
            .approve(alternativeSetup.seed.address, getFundingAmounts("102"));
          await seedToken
            .connect(root)
            .transfer(
              alternativeSetup.seed.address,
              requiredSeedAmount.toString()
            );
          await alternativeSetup.seed
            .connect(buyer1)
            .buy(getFundingAmounts("5"));
        });

        it("is not possible to buy", async () => {
          await expectRevert(
            alternativeSetup.seed
              .connect(buyer1)
              .claim(buyer1.address, getSeedAmounts("5")),
            "Seed: minimum funding amount not met"
          );
        });
      });

      context("» generics", () => {
        it("claim = 0 when not currentTime<endTime", async () => {
          expect(
            (await setup.seed.calculateClaim(buyer2.address)).toString()
          ).to.equal("0");
        });
        it("it cannot claim before vestingCliff", async () => {
          await time.increase(eightyNineDaysInSeconds);
          await expectRevert(
            setup.seed
              .connect(buyer1)
              .claim(buyer1.address, claimAmount.toString()),
            "Seed: amount claimable is 0"
          );
        });
        it("calculates correct claim", async () => {
          // increase time
          await time.increase(tenDaysInSeconds);
          const claim = await setup.seed.calculateClaim(buyer1.address);
          const vestingStartTime = await setup.seed.vestingStartTime();
          const expectedClaim = (await time.latest())
            .sub(new BN(vestingStartTime.toNumber()))
            .mul(new BN(buySeedAmount).mul(new BN(twoBN)))
            .div(new BN(vestingDuration));
          expect(claim.toString()).to.equal(expectedClaim.toString());
        });
        it("claim = 0 when not contributed", async () => {
          expect(
            (await setup.seed.calculateClaim(buyer2.address)).toString()
          ).to.equal("0");
        });
        it("it cannot claim if not vested", async () => {
          await expectRevert(
            setup.seed
              .connect(buyer1)
              .claim(
                buyer2.address,
                new BN(buySeedAmount)
                  .mul(new BN(twoBN))
                  .add(new BN(one))
                  .toString()
              ),
            "Seed: amount claimable is 0"
          );
        });
        it("it cannot claim more than claimable amount", async () => {
          await expectRevert(
            setup.seed
              .connect(buyer1)
              .claim(
                buyer1.address,
                new BN(buySeedAmount)
                  .mul(new BN(twoBN))
                  .add(new BN(one))
                  .toString()
              ),
            "Seed: request is greater than claimable amount"
          );
        });
        it("it returns amount of the fee", async () => {
          let feeSent = await setup.seed
            .connect(buyer1)
            .callStatic.claim(buyer1.address, claimAmount.toString());
          expect(feeSent.toString()).to.equal(feeAmount.toString());
        });
        it("it withdraws tokens after time passes", async () => {
          // claim lock

          // feeAmountOnClaim = (_claimAmount * fee) / 100;
          feeAmountOnClaim = new BN(claimAmount)
            .mul(new BN(fee))
            .div(new BN(PRECISION.toString()));

          await expect(
            setup.seed
              .connect(buyer1)
              .claim(buyer1.address, claimAmount.toString())
          )
            .to.emit(setup.seed, "TokensClaimed")
            .withArgs(
              buyer1.address,
              claimAmount,
              beneficiary.address,
              feeAmountOnClaim.toString()
            );
        });
        it("updates claim", async () => {
          expect(
            (await setup.seed.funders(buyer1.address)).totalClaimed.toString()
          ).to.equal(claimAmount.toString());
        });
        it("transfers correct fee to beneficiary", async () => {
          expect(
            (await seedToken.balanceOf(beneficiary.address)).toString()
          ).to.equal(feeAmount.toString());
        });
        it("updates the amount of seed claimed by the claim amount", async () => {
          totalClaimedByBuyer1 = claimAmount;
          expect((await setup.seed.seedClaimed()).toString()).to.equal(
            claimAmount.toString()
          );
        });
        it("updates the amount of seed transfered as fee to beneficiary", async () => {
          expect((await setup.seed.feeClaimed()).toString()).to.equal(
            feeAmount.toString()
          );
        });
        it("calculates and claims exact seed amount", async () => {
          const claim = await setup.seed.calculateClaim(buyer1.address);
          feeAmountOnClaim = new BN(claim.toString())
            .mul(new BN(fee))
            .div(new BN(PRECISION.toString()));

          totalClaimedByBuyer1 = totalClaimedByBuyer1.add(
            new BN(claim.toString())
          );

          await expect(setup.seed.connect(buyer1).claim(buyer1.address, claim))
            .to.emit(setup.seed, "TokensClaimed")
            .withArgs(
              buyer1.address,
              claim,
              beneficiary.address,
              feeAmountOnClaim.toString()
            );
        });
      });
      context("» claim after vesting duration", async () => {
        before("!! deploy new contract + top up buyer balance", async () => {
          let newStartTime = await time.latest();
          let newEndTime = await newStartTime.add(await time.duration.days(7));

          setup.data.seed = await init.getContractInstance(
            "Seed",
            setup.roles.prime
          );
          setup;

          await seedToken
            .connect(root)
            .transfer(setup.data.seed.address, requiredSeedAmount.toString());
          await fundingToken
            .connect(buyer2)
            .transfer(
              buyer3.address,
              await fundingToken.balanceOf(buyer2.address)
            );
          await fundingToken
            .connect(root)
            .transfer(
              buyer2.address,
              new BN(buyAmount).mul(new BN(twoBN)).toString()
            );
          await fundingToken
            .connect(buyer2)
            .approve(
              setup.data.seed.address,
              new BN(buyAmount).mul(new BN(twoBN)).toString()
            );

          await setup.data.seed.initialize(
            beneficiary.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            newStartTime.toNumber(),
            newEndTime.toNumber(),
            vestingDuration.toNumber(),
            vestingCliff.toNumber(),
            permissionedSeed,
            fee
          );

          await setup.data.seed
            .connect(buyer2)
            .buy(new BN(buyAmount).mul(new BN(twoBN)).toString());
        });
        it("claims all seeds after vesting duration", async () => {
          time.increase(await time.duration.days(7));
          time.increase(vestingDuration.toNumber());
          setup.data.prevBalance = await seedToken.balanceOf(
            beneficiary.address
          );

          const claimTemp = new BN(buySeedAmount).mul(new BN(twoBN)).toString();
          feeAmountOnClaim = new BN(claimTemp)
            .mul(new BN(fee))
            .div(new BN(PRECISION.toString()));

          await expect(
            setup.data.seed
              .connect(buyer2)
              .claim(buyer2.address, claimTemp.toString())
          )
            .to.emit(setup.data.seed, "TokensClaimed")
            .withArgs(
              buyer2.address,
              claimTemp.toString(),
              beneficiary.address,
              feeAmountOnClaim.toString()
            );
        });
        it("it claims all the fee", async () => {
          const feeAmountRequired = await setup.data.seed.feeAmountRequired();
          const feeClaimed = await setup.data.seed.feeClaimed();
          expect(feeAmountRequired.toString()).to.equal(feeClaimed.toString());
        });
        it("funds DAO with all the fee", async () => {
          // get total fundingAmount and calculate fee here
          const fee = await setup.data.seed.feeForFunder(buyer2.address);
          expect(
            (await seedToken.balanceOf(beneficiary.address)).toString()
          ).to.equal(fee.add(setup.data.prevBalance).toString());
          delete setup.data.prevBalance;
        });
      });
      context("» claim when vesting duration is 0", async () => {
        before("!! deploy new contract + top up buyer balance", async () => {
          let newStartTime = await time.latest();
          let newEndTime = await newStartTime.add(await time.duration.days(7));

          setup.data.seed = await init.getContractInstance(
            "Seed",
            setup.roles.prime
          );
          setup;

          await seedToken
            .connect(root)
            .transfer(setup.data.seed.address, requiredSeedAmount.toString());
          await fundingToken
            .connect(buyer2)
            .transfer(
              buyer3.address,
              await fundingToken.balanceOf(buyer2.address)
            );
          await fundingToken
            .connect(root)
            .transfer(
              buyer2.address,
              new BN(buyAmount).mul(new BN(twoBN)).toString()
            );
          await fundingToken
            .connect(buyer2)
            .approve(
              setup.data.seed.address,
              new BN(buyAmount).mul(new BN(twoBN)).toString()
            );

          await setup.data.seed.initialize(
            beneficiary.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            newStartTime.toNumber(),
            newEndTime.toNumber(),
            0,
            0,
            permissionedSeed,
            fee
          );

          await setup.data.seed
            .connect(buyer2)
            .buy(new BN(buyAmount).mul(new BN(twoBN)).toString());
        });
        it("claims all seeds after vesting duration", async () => {
          setup.data.prevBalance = await seedToken.balanceOf(
            beneficiary.address
          );

          const claimTemp = new BN(buySeedAmount).mul(new BN(twoBN)).toString();
          feeAmountOnClaim = new BN(claimTemp)
            .mul(new BN(fee))
            .div(new BN(PRECISION.toString()));

          await expect(
            setup.data.seed
              .connect(buyer2)
              .claim(buyer2.address, claimTemp.toString())
          )
            .to.emit(setup.data.seed, "TokensClaimed")
            .withArgs(
              buyer2.address,
              claimTemp.toString(),
              beneficiary.address,
              feeAmountOnClaim.toString()
            );

          // const receipt = await expectEvent.inTransaction(setup.data.tx.tx, setup.data.seed, "TokensClaimed");
          // expect(await receipt.args[1].toString()).to.equal(new BN(buySeedAmount).mul(twoBN).toString());
        });
        it("it claims all the fee for a buyer's claim", async () => {
          const fee = await setup.data.seed.feeForFunder(buyer2.address);
          const feeClaimed = await setup.data.seed.feeClaimedForFunder(
            buyer2.address
          );
          expect(fee.toString()).to.equal(feeClaimed.toString());
        });
        it("it claims all the fee", async () => {
          const feeAmountRequired = await setup.data.seed.feeAmountRequired();
          const feeClaimed = await setup.data.seed.feeClaimed();
          expect(feeAmountRequired.toString()).to.equal(feeClaimed.toString());
        });
        it("funds DAO with all the fee", async () => {
          // get fundingAmount and calculate fee here
          const fee = await setup.data.seed.feeForFunder(buyer2.address);
          expect(
            (await seedToken.balanceOf(beneficiary.address)).toString()
          ).to.equal(fee.add(setup.data.prevBalance).toString());
          delete setup.data.prevBalance;
        });
      });
      context("» ERC20 transfer fails", () => {
        it("reverts 'Seed: seed token transfer failed' ", async () => {
          const alternativeSetup = await deploy();
          const CustomERC20MockFactory = await ethers.getContractFactory(
            "CustomERC20Mock",
            root
          );
          const fakeSeedToken = await CustomERC20MockFactory.deploy(
            "DAI Stablecoin",
            "DAI"
          );
          const altStartTime = await time.latest();
          const altEndTime = await altStartTime.add(
            await time.duration.days(7)
          );
          const altVestingDuration = time.duration.days(365);
          const altVestingCliff = time.duration.days(9);
          await alternativeSetup.seed.initialize(
            beneficiary.address,
            admin.address,
            [fakeSeedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            altStartTime.toNumber(),
            altEndTime.toNumber(),
            altVestingDuration.toNumber(),
            altVestingCliff.toNumber(),
            permissionedSeed,
            fee
          );
          await fundingToken
            .connect(root)
            .transfer(buyer1.address, getFundingAmounts("102"));
          await fundingToken
            .connect(buyer1)
            .approve(alternativeSetup.seed.address, getFundingAmounts("102"));
          await fakeSeedToken
            .connect(root)
            .transfer(
              alternativeSetup.seed.address,
              requiredSeedAmount.toString()
            );
          await alternativeSetup.seed
            .connect(buyer1)
            .buy(getFundingAmounts("102"));
          await time.increase(tenDaysInSeconds);
          const correctClaimAmount = await alternativeSetup.seed.calculateClaim(
            buyer1.address
          );
          await fakeSeedToken.burn(alternativeSetup.seed.address);
          await expectRevert(
            alternativeSetup.seed
              .connect(buyer1)
              .claim(buyer1.address, correctClaimAmount.toString()),
            "Seed: seed token transfer failed"
          );
        });
      });
    });
    context("# retrieveFundingTokens", () => {
      context("» Seed: distribution hasn't started", () => {
        it("reverts 'Seed: distribution haven't started' ", async () => {
          let futureStartTime = (await time.latest()).add(
            await time.duration.days(2)
          );
          let futureEndTime = await futureStartTime.add(
            await time.duration.days(7)
          );

          const alternativeSetup = await deploy();
          await alternativeSetup.seed.initialize(
            beneficiary.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            futureStartTime.toNumber(),
            futureEndTime.toNumber(),
            vestingDuration.toNumber(),
            vestingCliff.toNumber(),
            permissionedSeed,
            fee
          );

          await expectRevert(
            alternativeSetup.seed.connect(buyer1).retrieveFundingTokens(),
            "Seed: distribution haven't started"
          );
        });
      });

      context("» generics", () => {
        before("!! deploy new contract + top up buyer balance", async () => {
          let newStartTime = await time.latest();
          let newEndTime = await newStartTime.add(await time.duration.days(7));

          setup.data.seed = await init.getContractInstance(
            "Seed",
            setup.roles.prime
          );
          setup;

          await seedToken
            .connect(root)
            .transfer(setup.data.seed.address, requiredSeedAmount.toString());
          await fundingToken
            .connect(root)
            .transfer(buyer2.address, smallBuyAmount);
          await fundingToken
            .connect(buyer2)
            .approve(setup.data.seed.address, smallBuyAmount);

          await setup.data.seed.initialize(
            beneficiary.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            newStartTime.toNumber(),
            newEndTime.toNumber(),
            vestingDuration.toNumber(),
            vestingCliff.toNumber(),
            permissionedSeed,
            fee
          );

          await setup.data.seed.connect(buyer2).buy(smallBuyAmount);
        });
        it("it cannot return funding tokens if not bought", async () => {
          await expectRevert(
            setup.data.seed.connect(buyer1).retrieveFundingTokens(),
            "Seed: zero funding amount"
          );
        });
        it("returns funding amount when called", async () => {
          const fundingAmount = await setup.data.seed
            .connect(buyer2)
            .callStatic.retrieveFundingTokens();
          expect((await fundingAmount).toString()).to.equal(smallBuyAmount);
        });
        it("returns funding tokens to buyer", async () => {
          const fundingAmount = await setup.data.seed
            .connect(buyer2)
            .callStatic.retrieveFundingTokens();

          expect(
            (await fundingToken.balanceOf(buyer2.address)).toString()
          ).to.equal(zero.toString());

          await expect(setup.data.seed.connect(buyer2).retrieveFundingTokens())
            .to.emit(setup.data.seed, "FundingReclaimed")
            .withArgs(buyer2.address, fundingAmount);

          expect(
            (await fundingToken.balanceOf(buyer2.address)).toString()
          ).to.equal(smallBuyAmount.toString());
        });
        it("clears `fee` mapping", async () => {
          // get fundingAmount to calculate fee
          expect(
            (await setup.data.seed.feeForFunder(buyer2.address)).toString()
          ).to.equal(zero.toString());
        });
        it("clears `tokenLock.amount`", async () => {
          // get fundingAmount to calculate seedAmount
          expect(
            (
              await setup.data.seed.seedAmountForFunder(buyer2.address)
            ).toString()
          ).to.equal(zero.toString());
        });
        it("updates `feeRemainder` ", async () => {
          expect((await setup.data.seed.feeRemainder()).toString()).to.equal(
            seedForFee.toString()
          );
        });
        it("updates remaining seeds", async () => {
          expect((await setup.data.seed.seedRemainder()).toString()).to.equal(
            seedForDistribution.toString()
          );
        });
        it("updates amount of funding token collected", async () => {
          expect(
            (await setup.data.seed.fundingCollected()).toString()
          ).to.equal("0");
        });
        it("cannot be called before funding minimum is reached", async () => {
          const currentBuyAmount = getFundingAmounts("10");
          await fundingToken
            .connect(root)
            .transfer(buyer2.address, currentBuyAmount);
          await fundingToken
            .connect(buyer2)
            .approve(setup.data.seed.address, currentBuyAmount);
          await setup.data.seed.connect(buyer2).buy(currentBuyAmount);
          await expectRevert(
            setup.data.seed.connect(buyer2).retrieveFundingTokens(),
            "Seed: minimum funding amount met"
          );
        });
      });
      context("» ERC20 transfer fails", () => {
        it("reverts 'Seed: cannot return funding tokens to msg.sender' ", async () => {
          const altStartTime = await time.latest();
          const altEndTime = await altStartTime.add(
            await time.duration.days(7)
          );
          const alternativeSetup = await deploy();
          const CustomERC20MockFactory = await ethers.getContractFactory(
            "CustomERC20Mock",
            setup.roles.prime
          );
          const alternativeFundingToken = await CustomERC20MockFactory.deploy(
            "DAI Stablecoin",
            "DAI"
          );
          await alternativeSetup.seed.initialize(
            beneficiary.address,
            admin.address,
            [seedToken.address, alternativeFundingToken.address],
            [softCap, hardCap],
            price,
            altStartTime.toNumber(),
            altEndTime.toNumber(),
            vestingDuration.toNumber(),
            vestingCliff.toNumber(),
            permissionedSeed,
            fee
          );
          await alternativeFundingToken
            .connect(root)
            .transfer(buyer1.address, getFundingAmounts("102"));
          await alternativeFundingToken
            .connect(buyer1)
            .approve(alternativeSetup.seed.address, getFundingAmounts("102"));
          await seedToken
            .connect(root)
            .transfer(
              alternativeSetup.seed.address,
              requiredSeedAmount.toString()
            );
          await alternativeSetup.seed
            .connect(buyer1)
            .buy(getFundingAmounts("5"));
          await alternativeFundingToken.burn(buyer1.address);
          await expectRevert(
            alternativeSetup.seed.connect(buyer1).retrieveFundingTokens(),
            "Seed: cannot return funding tokens to msg.sender"
          );
        });
      });
    });
    context("# close", () => {
      context("» generics", () => {
        before("!! deploy new contract + top up buyer balance", async () => {
          let newStartTime = await time.latest();
          let newEndTime = await newStartTime.add(await time.duration.days(7));

          setup.data.seed = await init.getContractInstance(
            "Seed",
            setup.roles.prime
          );
          setup;

          await seedToken
            .connect(root)
            .transfer(setup.data.seed.address, requiredSeedAmount.toString());

          setup.data.seed.initialize(
            beneficiary.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            newStartTime.toNumber(),
            newEndTime.toNumber(),
            vestingDuration.toNumber(),
            vestingCliff.toNumber(),
            permissionedSeed,
            fee
          );

          await fundingToken
            .connect(buyer2)
            .approve(setup.data.seed.address, smallBuyAmount);
          await setup.data.seed.connect(buyer2).buy(smallBuyAmount);
        });
        it("can only be called by admin", async () => {
          await expectRevert(
            setup.data.seed.connect(buyer1).close(),
            "Seed: caller should be admin"
          );
        });
        it("does not refund anything when, closed == false but contribution didn't end", async () => {
          await expect(
            setup.data.seed.connect(admin).retrieveSeedTokens(admin.address)
          ).to.be.revertedWith(
            "Seed: The ability to buy seed tokens must have ended before remaining seed tokens can be withdrawn"
          );
        });
        it("close seed token distribution", async () => {
          expect(await setup.data.seed.closed()).to.equal(false);
          await setup.data.seed.connect(admin).close();
          expect(await setup.data.seed.closed()).to.equal(true);
        });
        it("refunds remaining seed tokens", async () => {
          let stBalance = await seedToken.balanceOf(setup.data.seed.address);
          await setup.data.seed
            .connect(admin)
            .retrieveSeedTokens(admin.address);
          expect(
            (await seedToken.balanceOf(admin.address)).toString()
          ).to.equal(stBalance.toString());
        });
        it("paused == false", async () => {
          expect(await setup.data.seed.paused()).to.equal(false);
        });
        it("it cannot buy when closed", async () => {
          await expectRevert(
            setup.data.seed.connect(buyer1).buy(buyAmount),
            "Seed: should not be closed"
          );
        });
        it("returns funding tokens to buyer", async () => {
          expect(
            (await fundingToken.balanceOf(buyer2.address)).toString()
          ).to.equal(zero.toString());

          const fundingAmount = await setup.data.seed
            .connect(buyer2)
            .callStatic.retrieveFundingTokens();

          await expect(setup.data.seed.connect(buyer2).retrieveFundingTokens())
            .to.emit(setup.data.seed, "FundingReclaimed")
            .withArgs(buyer2.address, fundingAmount);

          expect(
            (await fundingToken.balanceOf(buyer2.address)).toString()
          ).to.equal(smallBuyAmount.toString());
        });
      });
      context("» ERC20 transfer failure", () => {
        let alternativeSetup, fakeSeedToken;

        beforeEach(async () => {
          alternativeSetup = await deploy();
          const CustomERC20MockFactory = await ethers.getContractFactory(
            "CustomERC20Mock",
            root
          );
          fakeSeedToken = await CustomERC20MockFactory.deploy(
            "DAI Stablecoin",
            "DAI"
          );
          const altStartTime = await time.latest();
          const altEndTime = await altStartTime.add(
            await time.duration.days(7)
          );
          const altVestingDuration = time.duration.days(365);
          const altVestingCliff = time.duration.days(9);
          await alternativeSetup.seed.initialize(
            beneficiary.address,
            admin.address,
            [fakeSeedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            altStartTime.toNumber(),
            altEndTime.toNumber(),
            altVestingDuration.toNumber(),
            altVestingCliff.toNumber(),
            permissionedSeed,
            fee
          );
          await fundingToken
            .connect(root)
            .transfer(buyer1.address, getFundingAmounts("102"));
          await fundingToken
            .connect(buyer1)
            .approve(alternativeSetup.seed.address, getFundingAmounts("102"));
          await fakeSeedToken
            .connect(root)
            .transfer(
              alternativeSetup.seed.address,
              requiredSeedAmount.toString()
            );
        });

        it("reverts 'Seed: should transfer seed tokens to refund receiver' when time to refund is NOT reached", async () => {
          await alternativeSetup.seed
            .connect(alternativeSetup.roles.prime)
            .close();
          await fakeSeedToken.burn(alternativeSetup.seed.address);
          await expectRevert(
            alternativeSetup.seed.retrieveSeedTokens(root.address),
            "Seed: should transfer seed tokens to refund receiver"
          );
        });

        it("reverts 'Seed: should transfer seed tokens to refund receiver' when time to refund is NOT reached", async () => {
          await alternativeSetup.seed.connect(buyer1).buy(buyAmount);
          await time.increase(await time.duration.days(7));
          await alternativeSetup.seed
            .connect(alternativeSetup.roles.prime)
            .close();
          await expectRevert(
            alternativeSetup.seed.retrieveSeedTokens(root.address),
            "Seed: should transfer seed tokens to refund receiver"
          );
        });
      });
      context("» close after minimum reached", () => {
        before("!! deploy new contract + top up buyer balance", async () => {
          let newStartTime = await time.latest();
          let newEndTime = await newStartTime.add(await time.duration.days(7));

          setup.data.seed = await init.getContractInstance(
            "Seed",
            setup.roles.prime
          );
          setup;

          await fundingToken
            .connect(root)
            .transfer(buyer2.address, buyAmount.toString());
          await seedToken
            .connect(root)
            .transfer(setup.data.seed.address, requiredSeedAmount.toString());

          setup.data.seed.initialize(
            beneficiary.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            newStartTime.toNumber(),
            newEndTime.toNumber(),
            vestingDuration.toNumber(),
            vestingCliff.toNumber(),
            permissionedSeed,
            fee
          );

          await fundingToken
            .connect(buyer2)
            .approve(setup.data.seed.address, buyAmount);
          await setup.data.seed.connect(buyer2).buy(buyAmount);
        });
        it("it refunds only seed amount that are not bought", async () => {
          const buyFee = new BN(buySeedAmount)
            .mul(new BN(fee))
            .div(new BN(PRECISION.toString()));
          const prevBal = await seedToken.balanceOf(admin.address);
          await setup.data.seed.connect(admin).close();
          await setup.data.seed
            .connect(admin)
            .retrieveSeedTokens(admin.address);
          expect(
            (await seedToken.balanceOf(admin.address)).toString()
          ).to.equal(
            requiredSeedAmount
              .add(new BN(prevBal.toString()))
              .sub(new BN(buySeedAmount))
              .sub(new BN(buyFee))
              .toString()
          );
        });
        it("paused == false", async () => {
          expect(await setup.data.seed.paused()).to.equal(false);
        });
      });
      context(
        "retrieve seed tokens after minimum reached and contribution is closed",
        async () => {
          before("!! deploy new contract + top up buyer balance", async () => {
            let newStartTime = await time.latest();
            let newEndTime = await newStartTime.add(
              await time.duration.days(7)
            );

            setup.data.seed = await init.getContractInstance(
              "Seed",
              setup.roles.prime
            );
            setup;

            await fundingToken
              .connect(root)
              .transfer(buyer2.address, buyAmount);
            await seedToken
              .connect(root)
              .transfer(setup.data.seed.address, requiredSeedAmount.toString());

            setup.data.seed.initialize(
              beneficiary.address,
              admin.address,
              [seedToken.address, fundingToken.address],
              [softCap, hardCap],
              price,
              newStartTime.toNumber(),
              newEndTime.toNumber(),
              vestingDuration.toNumber(),
              vestingCliff.toNumber(),
              permissionedSeed,
              fee
            );

            await fundingToken
              .connect(buyer2)
              .approve(setup.data.seed.address, buyAmount);
            await setup.data.seed.connect(buyer2).buy(buyAmount);
          });
          it("cannot refund if only minimum is reached but contribution didn't end", async () => {
            await expect(
              setup.data.seed.connect(admin).retrieveSeedTokens(admin.address)
            ).to.be.revertedWith(
              "Seed: The ability to buy seed tokens must have ended before remaining seed tokens can be withdrawn"
            );
          });
          it("retrieves remaining seed tokens after minimumReached == true and contribution ended", async () => {
            await time.increase(time.duration.days(7));
            const buyFee = new BN(buySeedAmount)
              .mul(new BN(fee))
              .div(new BN(PRECISION.toString()));
            const prevBal = await seedToken.balanceOf(admin.address);
            await setup.data.seed.connect(admin).close();
            await setup.data.seed
              .connect(admin)
              .retrieveSeedTokens(admin.address);
            expect(
              (await seedToken.balanceOf(admin.address)).toString()
            ).to.equal(
              requiredSeedAmount
                .add(new BN(prevBal.toString()))
                .sub(new BN(buySeedAmount))
                .sub(new BN(buyFee))
                .toString()
            );
          });
        }
      );
    });
    context("# getter functions", () => {
      context("» checkWhitelisted", () => {
        it("returns correct bool", async () => {
          // default false - contract not whitelist contract
          expect(await setup.seed.whitelisted(buyer1.address)).to.equal(false);
        });
      });
      context("» getAmount", () => {
        it("returns correct amount", async () => {
          // get fundingAmount to calculate seedAmount
          expect(
            (await setup.seed.seedAmountForFunder(buyer1.address)).toString()
          ).to.equal(new BN(buySeedAmount).mul(new BN(twoBN)).toString());
        });
      });
      context("» getTotalClaimed", () => {
        it("returns correct claimed", async () => {
          expect(
            (await setup.seed.funders(buyer1.address)).totalClaimed.toString()
          ).to.equal(totalClaimedByBuyer1.toString());
        });
      });
      context("» getFee", () => {
        it("returns correct fee", async () => {
          let amount = new BN(buySeedAmount);
          let amountMinusFee = new BN(amount.mul(twoBN).div(new BN(hundred)));
          // get fundingAmount to calculate fee
          expect(
            (await setup.seed.feeForFunder(buyer1.address)).toString()
          ).to.equal(amountMinusFee.mul(twoBN).toString());
        });
      });
      describe("» getStartTime", () => {
        it("returns correct startTime", async () => {
          expect((await setup.seed.startTime()).toString()).to.equal(
            startTime.toString()
          );
        });
      });
    });
    context("# admin functions", () => {
      context("» update metadata", () => {
        it("can only be called by admin", async () => {
          await expectRevert(
            setup.seed.connect(buyer1).updateMetadata(metadata),
            "Seed: contract should not be initialized or caller should be admin"
          );
        });
        it("updates metadata", async () => {
          await expect(setup.seed.connect(admin).updateMetadata(metadata))
            .to.emit(setup.seed, "MetadataUpdated")
            .withArgs(metadata);
        });
      });
      context("» pause", () => {
        it("can only be called by admin", async () => {
          await expectRevert(
            setup.seed.connect(buyer1).pause(),
            "Seed: caller should be admin"
          );
        });
        it("pauses contract", async () => {
          await setup.seed.connect(admin).pause();
          expect(await setup.seed.paused()).to.equal(true);
        });
        it("it cannot buy when paused", async () => {
          await expectRevert(
            setup.seed.connect(buyer1).buy(buyAmount),
            "Seed: should not be paused"
          );
        });
      });
      context("» unpause", () => {
        context("seed is paused/closed", async () => {
          let alternativeSeed;

          beforeEach(async () => {
            let newStartTime = await time.latest();
            let newEndTime = await newStartTime.add(
              await time.duration.days(7)
            );

            alternativeSeed = await init.getContractInstance(
              "Seed",
              setup.roles.prime
            );
            await seedToken
              .connect(root)
              .transfer(alternativeSeed.address, requiredSeedAmount.toString());

            alternativeSeed.initialize(
              beneficiary.address,
              admin.address,
              [seedToken.address, fundingToken.address],
              [softCap, hardCap],
              price,
              newStartTime.toNumber(),
              newEndTime.toNumber(),
              vestingDuration.toNumber(),
              vestingCliff.toNumber(),
              permissionedSeed,
              fee
            );
          });

          it("reverts: 'Seed: should not be closed'", async () => {
            await time.increase(tenDaysInSeconds);
            await alternativeSeed.connect(admin).close();
            await expectRevert(
              alternativeSeed.connect(admin).unpause(),
              "Seed: should not be closed"
            );
          });

          it("trying to close again", async () => {
            await alternativeSeed.connect(admin).close();
            await expectRevert(
              alternativeSeed.connect(admin).close(),
              "Seed: should not be closed"
            );
          });

          it("reverts: 'Seed: should be paused'", async () => {
            await expectRevert(
              alternativeSeed.connect(admin).unpause(),
              "Seed: should be paused"
            );
          });
        });

        it("can only be called by admin", async () => {
          await expectRevert(
            setup.seed.connect(buyer1).unpause(),
            "Seed: caller should be admin"
          );
        });
        it("unpauses contract", async () => {
          await setup.seed.connect(admin).unpause();
          expect(await setup.seed.paused()).to.equal(false);
        });
      });
      context("» unwhitelist", () => {
        context("seed is closed", async () => {
          it("reverts: 'Seed: should not be closed'", async () => {
            const newStartTime = await time.latest();
            const newEndTime = await newStartTime.add(
              await time.duration.days(7)
            );

            const alternativeSeed = await init.getContractInstance(
              "Seed",
              setup.roles.prime
            );
            setup;
            await seedToken
              .connect(root)
              .transfer(alternativeSeed.address, requiredSeedAmount.toString());

            alternativeSeed.initialize(
              beneficiary.address,
              admin.address,
              [seedToken.address, fundingToken.address],
              [softCap, hardCap],
              price,
              newStartTime.toNumber(),
              newEndTime.toNumber(),
              vestingDuration.toNumber(),
              vestingCliff.toNumber(),
              permissionedSeed,
              fee
            );
            await time.increase(tenDaysInSeconds);
            await alternativeSeed.close();
            await expectRevert(
              alternativeSeed.connect(admin).unwhitelist(buyer1.address),
              "Seed: should not be closed"
            );
          });
        });
        it("can only be called by admin", async () => {
          await expectRevert(
            setup.seed.connect(buyer1).unwhitelist(buyer1.address),
            "Seed: caller should be admin"
          );
        });
        it("reverts: can only be called on whitelisted contract", async () => {
          await expectRevert(
            setup.seed.connect(admin).whitelist(buyer1.address),
            "Seed: seed is not whitelisted"
          );
        });
      });
      context("» whitelist", () => {
        context("seed is closed", async () => {
          it("reverts: 'Seed: should not be closed'", async () => {
            const newStartTime = await time.latest();
            const newEndTime = await newStartTime.add(
              await time.duration.days(7)
            );

            const alternativeSeed = await init.getContractInstance(
              "Seed",
              setup.roles.prime
            );
            setup;
            await seedToken
              .connect(root)
              .transfer(alternativeSeed.address, requiredSeedAmount.toString());

            alternativeSeed.initialize(
              beneficiary.address,
              admin.address,
              [seedToken.address, fundingToken.address],
              [softCap, hardCap],
              price,
              newStartTime.toNumber(),
              newEndTime.toNumber(),
              vestingDuration.toNumber(),
              vestingCliff.toNumber(),
              permissionedSeed,
              fee
            );
            await time.increase(tenDaysInSeconds);
            await alternativeSeed.close();
            await expectRevert(
              alternativeSeed.connect(admin).whitelist(buyer1.address),
              "Seed: should not be closed"
            );
          });
        });
        it("can only be called by admin", async () => {
          await expectRevert(
            setup.seed.connect(buyer1).whitelist(buyer1.address),
            "Seed: caller should be admin"
          );
        });
        it("reverts: can only be called on whitelisted contract", async () => {
          await expectRevert(
            setup.seed.connect(admin).whitelist(buyer1.address),
            "Seed: seed is not whitelisted"
          );
        });
      });
      context("» withdraw", () => {
        before("!! deploy new contract", async () => {
          let newStartTime = await time.latest();
          let newEndTime = await newStartTime.add(await time.duration.days(7));

          setup.data.seed = await init.getContractInstance(
            "Seed",
            setup.roles.prime
          );
          setup;

          await seedToken
            .connect(root)
            .transfer(setup.data.seed.address, requiredSeedAmount.toString());
          await fundingToken
            .connect(root)
            .transfer(buyer2.address, buyAmount.toString());
          await fundingToken
            .connect(buyer2)
            .approve(setup.data.seed.address, buyAmount.toString());

          setup.data.seed.initialize(
            beneficiary.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            newStartTime.toNumber(),
            newEndTime.toNumber(),
            vestingDuration.toNumber(),
            vestingCliff.toNumber(),
            permissionedSeed,
            fee
          );
        });
        it("can not withdraw before minumum funding amount is met", async () => {
          await expectRevert(
            setup.data.seed.connect(admin).withdraw(),
            "Seed: cannot withdraw while funding tokens can still be withdrawn by contributors"
          );
        });
        it("cannot withdraw after minimum funding amount is met", async () => {
          await setup.data.seed.connect(buyer2).buy(buyAmount);
          await expectRevert(
            setup.data.seed.connect(admin).withdraw(),
            "Seed: cannot withdraw while funding tokens can still be withdrawn by contributors"
          );
        });
        it("can only withdraw after vesting starts", async () => {
          await time.increase(time.duration.days(7));
          await setup.data.seed.connect(admin).withdraw();
          expect(
            (await fundingToken.balanceOf(setup.data.seed.address)).toString()
          ).to.equal(zero.toString());
          expect(
            (await fundingToken.balanceOf(admin.address)).toString()
          ).to.equal(buyAmount);
        });
        it("updates the amount of funding token withdrawn", async () => {
          await expect(
            (await setup.data.seed.fundingWithdrawn()).toString()
          ).to.equal(buyAmount);
        });
        it("can only be called by admin", async () => {
          await expectRevert(
            setup.seed.connect(buyer1).withdraw(),
            "Seed: caller should be admin"
          );
        });
      });
    });
  });
  context("creator is avatar -- whitelisted contract", () => {
    before("!! deploy setup", async () => {
      setup = await deploy();

      // Tokens used
      fundingToken = setup.token.fundingToken;
      fundingTokenDecimal = await getDecimals(fundingToken);
      getFundingAmounts = getTokenAmount(fundingTokenDecimal);

      seedToken = setup.token.seedToken;
      seedTokenDecimal = await getDecimals(seedToken);
      getSeedAmounts = getTokenAmount(seedTokenDecimal);

      // // Roles
      root = setup.roles.root;
      beneficiary = setup.roles.beneficiary;
      admin = setup.roles.prime;
      buyer1 = setup.roles.buyer1;
      buyer2 = setup.roles.buyer2;
      buyer3 = setup.roles.buyer3;
      buyer4 = setup.roles.buyer3;

      // // Parameters to initialize seed contract
      softCap = getFundingAmounts("10").toString();
      hardCap = getFundingAmounts("102").toString();
      price = parseUnits(
        "0.01",
        parseInt(fundingTokenDecimal) - parseInt(seedTokenDecimal) + 18
      ).toString();
      buyAmount = getFundingAmounts("51").toString();
      startTime = await time.latest();
      endTime = await startTime.add(await time.duration.days(7));
      vestingDuration = time.duration.days(365); // 1 year
      vestingCliff = time.duration.days(90); // 3 months
      permissionedSeed = true;
      fee = parseEther("0.02").toString(); // 2%

      seedForDistribution = new BN(hardCap)
        .div(new BN(price))
        .mul(new BN(PRECISION.toString()));
      seedForFee = seedForDistribution
        .mul(new BN(fee))
        .div(new BN(PRECISION.toString()));
      requiredSeedAmount = seedForDistribution.add(seedForFee);
    });
    context("» contract is not initialized yet", () => {
      context("» parameters are valid", () => {
        before("!! deploy new contract", async () => {
          seed = await init.getContractInstance("Seed", setup.roles.prime);
          setup;
        });
        it("initializes", async () => {
          // emulate creation & initialization via seedfactory & fund with seedTokens
          await seedToken
            .connect(root)
            .transfer(seed.address, requiredSeedAmount.toString());

          await seed.initialize(
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
          expect(await seed.initialized()).to.equal(true);
          expect(await seed.beneficiary()).to.equal(beneficiary.address);
          expect(await seed.admin()).to.equal(admin.address);
          expect(await seed.seedToken()).to.equal(seedToken.address);
          expect(await seed.fundingToken()).to.equal(fundingToken.address);
          expect((await seed.softCap()).toString()).to.equal(softCap);
          expect((await seed.price()).toString()).to.equal(price);
          expect(await seed.permissionedSeed()).to.equal(permissionedSeed);
          expect((await seed.fee()).toString()).to.equal(fee.toString());
          expect(await seed.closed()).to.equal(false);
          expect((await seed.seedAmountRequired()).toString()).to.equal(
            seedForDistribution.toString()
          );
          expect((await seed.feeAmountRequired()).toString()).to.equal(
            seedForFee.toString()
          );
          expect((await seed.seedRemainder()).toString()).to.equal(
            seedForDistribution.toString()
          );
          expect((await seed.feeRemainder()).toString()).to.equal(
            seedForFee.toString()
          );
          expect((await seedToken.balanceOf(seed.address)).toString()).to.equal(
            requiredSeedAmount.toString()
          );
        });
        it("it reverts on double initialization", async () => {
          await expectRevert(
            seed.initialize(
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
            ),
            "Seed: contract already initialized"
          );
        });
      });
    });
    context("# admin whitelist functions", () => {
      context("» whitelist", () => {
        it("adds a user to the whitelist", async () => {
          expect(await seed.whitelisted(buyer1.address)).to.equal(false);
          await seed.connect(admin).whitelist(buyer1.address);
          expect(await seed.whitelisted(buyer1.address)).to.equal(true);
        });
      });
      context("» unwhitelist", () => {
        it("removes a user from the whitelist", async () => {
          expect(await seed.whitelisted(buyer1.address)).to.equal(true);
          await seed.connect(admin).unwhitelist(buyer1.address);
          expect(await seed.whitelisted(buyer1.address)).to.equal(false);
        });
        it("reverts when unwhitelist account buys", async () => {
          await expectRevert(
            seed.connect(buyer1).buy(getFundingAmounts("1").toString()),
            "Seed: sender has no rights"
          );
        });
      });
      context("» whitelistBatch", () => {
        context("seed is closed", async () => {
          it("reverts: 'Seed: should not be closed'", async () => {
            const newStartTime = await time.latest();
            const newEndTime = await newStartTime.add(
              await time.duration.days(7)
            );

            const alternativeSeed = await init.getContractInstance(
              "Seed",
              setup.roles.prime
            );
            setup;
            await seedToken
              .connect(root)
              .transfer(alternativeSeed.address, requiredSeedAmount.toString());

            alternativeSeed.initialize(
              beneficiary.address,
              admin.address,
              [seedToken.address, fundingToken.address],
              [softCap, hardCap],
              price,
              newStartTime.toNumber(),
              newEndTime.toNumber(),
              vestingDuration.toNumber(),
              vestingCliff.toNumber(),
              permissionedSeed,
              fee
            );
            await time.increase(tenDaysInSeconds);
            await alternativeSeed.close();
            await expectRevert(
              alternativeSeed
                .connect(admin)
                .whitelistBatch([buyer1.address, buyer2.address]),
              "Seed: should not be closed"
            );
          });
        });
        it("can only be called by admin", async () => {
          await expectRevert(
            seed
              .connect(buyer1)
              .whitelistBatch([buyer1.address, buyer2.address]),
            "Seed: caller should be admin"
          );
        });
        it("adds users to the whitelist", async () => {
          expect(await seed.whitelisted(buyer3.address)).to.equal(false);
          expect(await seed.whitelisted(buyer4.address)).to.equal(false);

          await seed
            .connect(admin)
            .whitelistBatch([buyer3.address, buyer4.address]);

          expect(await seed.whitelisted(buyer3.address)).to.equal(true);
          expect(await seed.whitelisted(buyer4.address)).to.equal(true);
          expect(await seed.isWhitelistBatchInvoked()).to.equal(true);
        });
      });
    });
    context("# hardCap", () => {
      context("» check hardCap", () => {
        it("cannot buy more than hardCap", async () => {
          const newStartTime = await time.latest();
          const newEndTime = await newStartTime.add(
            await time.duration.days(7)
          );
          const alternativeSetup = await deploy();
          await alternativeSetup.seed.initialize(
            beneficiary.address,
            admin.address,
            [seedToken.address, fundingToken.address],
            [softCap, hardCap],
            price,
            newStartTime.toNumber(),
            newEndTime.toNumber(),
            vestingDuration.toNumber(),
            vestingCliff.toNumber(),
            permissionedSeed,
            fee
          );
          await seedToken
            .connect(root)
            .transfer(
              alternativeSetup.seed.address,
              requiredSeedAmount.toString()
            );
          await fundingToken
            .connect(root)
            .transfer(buyer2.address, getFundingAmounts("102"));
          await fundingToken
            .connect(buyer2)
            .approve(alternativeSetup.seed.address, getFundingAmounts("102"));
          await alternativeSetup.seed.connect(admin).whitelist(buyer2.address);
          await alternativeSetup.seed
            .connect(buyer2)
            .buy(getFundingAmounts("102"));
          await expectRevert(
            alternativeSetup.seed.connect(buyer2).buy(twoHundredFourETH),
            "Seed: maximum funding reached"
          );
        });
      });
    });
  });
  context("» price test of tokens with decimals 6", () => {
    before("!! setup", async () => {
      setup = await deploy();

      const CustomDecimalERC20Mock = await ethers.getContractFactory(
        "CustomDecimalERC20Mock",
        setup.roles.root
      );

      // Tokens used
      fundingToken = await CustomDecimalERC20Mock.deploy("USDC", "USDC", 6);
      fundingTokenDecimal = await getDecimals(fundingToken);
      getFundingAmounts = getTokenAmount(fundingTokenDecimal);

      seedToken = setup.token.seedToken;
      seedTokenDecimal = await getDecimals(seedToken);
      getSeedAmounts = getTokenAmount(seedTokenDecimal);

      // // Roles
      root = setup.roles.root;
      beneficiary = setup.roles.beneficiary;
      admin = setup.roles.prime;
      buyer1 = setup.roles.buyer1;
      buyer2 = setup.roles.buyer2;
      buyer3 = setup.roles.buyer3;

      // // Parameters to initialize seed contract
      softCap = getFundingAmounts("10").toString();
      hardCap = getFundingAmounts("102").toString();
      buyAmount = getFundingAmounts("51").toString();
      smallBuyAmount = getFundingAmounts("9").toString();
      buySeedAmount = getSeedAmounts("5100").toString();
      price = parseUnits(
        "1",
        parseInt(fundingTokenDecimal) - parseInt(seedTokenDecimal) + 18
      ).toString();
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
      await fundingToken
        .connect(root)
        .transfer(buyer1.address, getFundingAmounts("102"));
      await fundingToken
        .connect(buyer1)
        .approve(setup.seed.address, getFundingAmounts("102"));

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
      const oneFundingTokenAmount = getFundingAmounts("1");
      await fundingToken
        .connect(buyer1)
        .approve(setup.seed.address, oneFundingTokenAmount);
      await setup.seed.connect(buyer1).buy(oneFundingTokenAmount);
      const expectedSeedAmount = oneFundingTokenAmount
        .mul(PRECISION)
        .div(BigNumber.from(price));
      expect(
        (await setup.seed.seedAmountForFunder(buyer1.address)).eq(
          expectedSeedAmount
        )
      ).to.be.true;
    });
  });
  context("» price test of both tokens with decimals 6", () => {
    before("!! setup", async () => {
      setup = await deploy();

      // Tokens used
      const CustomDecimalERC20Mock = await ethers.getContractFactory(
        "CustomDecimalERC20Mock",
        setup.roles.root
      );
      fundingToken = await CustomDecimalERC20Mock.deploy("USDC", "USDC", 6);
      fundingTokenDecimal = await getDecimals(fundingToken);
      getFundingAmounts = getTokenAmount(fundingTokenDecimal);

      seedToken = await CustomDecimalERC20Mock.deploy("Prime", "Prime", 6);
      seedTokenDecimal = await getDecimals(seedToken);
      getSeedAmounts = getTokenAmount(seedTokenDecimal);

      // // Roles
      root = setup.roles.root;
      beneficiary = setup.roles.beneficiary;
      admin = setup.roles.prime;
      buyer1 = setup.roles.buyer1;
      buyer2 = setup.roles.buyer2;
      buyer3 = setup.roles.buyer3;

      // // Parameters to initialize seed contract
      softCap = getFundingAmounts("10").toString();
      hardCap = getFundingAmounts("102").toString();
      buyAmount = getFundingAmounts("51").toString();
      smallBuyAmount = getFundingAmounts("9").toString();
      buySeedAmount = getSeedAmounts("5100", seedTokenDecimal).toString();
      price = parseUnits(
        "1",
        parseInt(fundingTokenDecimal) - parseInt(seedTokenDecimal) + 18
      ).toString();
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
      await fundingToken
        .connect(root)
        .transfer(buyer1.address, getFundingAmounts("102"));
      await fundingToken
        .connect(buyer1)
        .approve(setup.seed.address, getFundingAmounts("102"));

      claimAmount = new BN(ninetyTwoDaysInSeconds).mul(
        new BN(buySeedAmount).mul(new BN(twoBN)).div(new BN(vestingDuration))
      );
      feeAmount = new BN(claimAmount)
        .mul(new BN(fee))
        .div(new BN(PRECISION.toString()));
      await seedToken
        .connect(root)
        .transfer(admin.address, requiredSeedAmount.toString());
      await seedToken
        .connect(admin)
        .transfer(setup.seed.address, requiredSeedAmount.toString());
    });
    it("$ buys with one funding token", async () => {
      const oneFundingTokenAmount = getFundingAmounts("100");
      await fundingToken
        .connect(buyer1)
        .approve(setup.seed.address, oneFundingTokenAmount);
      await setup.seed.connect(buyer1).buy(oneFundingTokenAmount);
      const expectedSeedAmount = oneFundingTokenAmount
        .mul(PRECISION)
        .div(BigNumber.from(price));
      expect(
        (await setup.seed.seedAmountForFunder(buyer1.address)).eq(
          expectedSeedAmount
        )
      ).to.be.true;
    });
  });
});
