/*global web3, contract, before, it, context, artifacts*/
/*eslint no-undef: "error"*/

const { expect } = require("chai");
const { ethers } = require("hardhat");
require("@nomiclabs/hardhat-waffle");

const { /*constants,*/ time, expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");
const helpers = require("./helpers/setup"); // Check why had to import like this?
const { parseUnits } = ethers.utils
const Seed = hre.artifacts.readArtifact('Seed');

const deploy = async (signer) => { // Deleted .setup from calls to setup.js. Ask why?
    // initialize test setup
    const setup = await helpers.initialize(signer);
    // deploy ERC20s
    setup.tokens = await helpers.tokens(setup);
    // deploy seed
    setup.seed = await helpers.seed();

    return setup;
};

describe("Seed", function() {
    let setup;
    let admin;
    let buyer1;
    let buyer2;
    let seedToken;
    let fundingToken;
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
    // let test;

    // constants
    const zero    = 0;
    const one     = 1;
    const hundred = 100;
    const PPM     = 1000000;
    const PPM100  = 100000000;
    const tenETH            = parseUnits("10");
    const hundredTwoETH     = parseUnits("102");
    const twoHundredFourETH = parseUnits("204");
    const twoBN    = new BN(2);
    const pct_base = new BN("1000000000000000000"); // 10**18
    const ninetyTwoDaysInSeconds  = time.duration.days(92);
    const eightyNineDaysInSeconds = time.duration.days(89);
    const tenDaysInSeconds      = time.duration.days(10);

    describe("» creator is avatar", () => {
        before("!! deploy setup", async () => {
            signers = await ethers.getSigners();
            [owner, admin, buyer1, buyer2, avatar] = signers;
            setup = await deploy(owner);
            seedToken    = setup.tokens.primeToken;
            fundingToken = setup.tokens.erc20s[0];
            softCap        = parseUnits("10"); // is this neccesary?
            hardCap        = parseUnits("102");
            price          = parseUnits("0.01");
            buyAmount      = parseUnits("51");
            smallBuyAmount = parseUnits("9");
            buySeedAmount  = parseUnits("5100");
            startTime = await time.latest();
            endTime   = await startTime.add(await time.duration.days(7));
            vestingDuration = time.duration.days(365); // 1 year
            vestingCliff    = time.duration.days(90); // 3 months
            permissionedSeed = false;
            fee = 2;
            metadata = `0x`;

            buySeedFee = new BN(buySeedAmount.toString()) // Check if this was correct
            .mul(new BN(PPM))
            .mul(new BN(fee))
            .div(new BN(PPM100));
            seedForDistribution = new BN(hardCap.toString()).div(new BN(price.toString())).mul(new BN(pct_base.toString()));
            seedForFee = seedForDistribution
                .mul(new BN(PPM))
                .mul(new BN(fee))
                .div(new BN(PPM100));
            requiredSeedAmount = seedForDistribution.add(seedForFee);
        });
        describe("» contract is not initialized yet", () => {
            describe("» parameters are valid", () => {
                it("it initializes seed", async () => {
                // emulate creation & initialization via seedfactory & fund with seedTokens

                    await setup.seed.initialize(
                        avatar.address,
                        admin.address,
                        [seedToken.address, fundingToken.address],
                        [softCap.toString(), hardCap.toString()],
                        [endTime.toString(), startTime.toString()],
                        price.toString(),
                        vestingDuration.toString(),
                        vestingCliff.toString(),
                        permissionedSeed,
                        fee
                    );

                    expect(await setup.seed.initialized()).to.equal(true);
                    expect(await setup.seed.beneficiary()).to.equal(avatar.address);
                    expect(await setup.seed.admin()).to.equal(admin.address);
                    expect(await setup.seed.seedToken()).to.equal(seedToken.address);
                    expect(await setup.seed.fundingToken()).to.equal(fundingToken.address);
                    expect((await setup.seed.softCap()).toString()).to.equal(softCap.toString());
                    expect((await setup.seed.price()).toString()).to.equal(price.toString());
                    expect(await setup.seed.permissionedSeed()).to.equal(permissionedSeed);
                    expect((await setup.seed.fee()).toString()).to.equal(fee.toString());
                    expect(await setup.seed.closed()).to.equal(false);
                    expect((await setup.seed.seedAmountRequired()).toString()).to.equal(seedForDistribution.toString());
                    expect((await setup.seed.feeAmountRequired()).toString()).to.equal(seedForFee.toString());
                    expect((await setup.seed.seedRemainder()).toString()).to.equal(seedForDistribution.toString());
                    expect((await setup.seed.feeRemainder()).toString()).to.equal(seedForFee.toString());
                    expect((await setup.seed.isFunded()).toString()).to.equal("false");
                });
                it("it reverts on double initialization", async () => {
                    await expectRevert(
                        setup.seed.initialize(
                            avatar.address,
                            admin.address,
                            [seedToken.address, fundingToken.address],
                            [softCap.toString(), hardCap.toString()],
                            [endTime.toString(), startTime.toString()],
                            price.toString(),
                            vestingDuration.toString(),
                            vestingCliff.toString(),
                            permissionedSeed,
                            fee
                        ),
                        "Seed: contract already initialized"
                    );
                });
            });
        });
        describe("# buy", () => {
            describe("» generics", () => {
                before("!! top up buyer1 balance", async () => {
                    console.log("here0")
                    // console.log(await fundingToken.balanceOf(setup.root.address))
                    // console.log(hundredTwoETH.toString())
                    await fundingToken.transfer(buyer1.address, hundredTwoETH.toString());
                    console.log("here0.2")
                    await fundingToken.approve(setup.seed.address, hundredTwoETH, { from: buyer1 });
                    claimAmount = new BN(ninetyTwoDaysInSeconds).mul(
                        new BN(buySeedAmount).mul(twoBN).div(new BN(vestingDuration))
                    );
                    feeAmount = new BN(claimAmount)
                        .mul(new BN(PPM))
                        .mul(new BN(fee))
                        .div(new BN(PPM100));
                });
                it("it cannot buy if not funded", async () => {
                    await expectRevert(
                        setup.seed.buy(buyAmount, { from: buyer1 }),
                        "Seed: sufficient seeds not provided"
                    );
                });
                it("it funds the Seed contract with Seed Token", async () => {
                    await seedToken.transfer(setup.seed.address, requiredSeedAmount, { from: setup.root });
                    expect((await seedToken.balanceOf(setup.seed.address)).toString()).to.equal(
                        requiredSeedAmount.toString()
                    );
                });
                it("it cannot buy when paused", async () => {
                    await setup.seed.pause({ from: admin });
                    await expectRevert(setup.seed.buy(buyAmount, { from: buyer1 }), "Seed: should not be paused");
                    await setup.seed.unpause({ from: admin });
                });
                it("it cannot buy 0 seeds", async () => {
                    await expectRevert(
                        setup.seed.buy(zero.toString(), { from: buyer1 }),
                        "Seed: amountVestedPerSecond > 0"
                    );
                });
                it("it buys tokens ", async () => {
                    let tx = await setup.seed.buy(buyAmount, { from: buyer1 });
                    setup.data.tx = tx;
                    await expectEvent.inTransaction(setup.data.tx.tx, setup.seed, "SeedsPurchased");
                    expect((await fundingToken.balanceOf(setup.seed.address)).toString()).to.equal(
                        ((buySeedAmount * price) / pct_base).toString()
                    );
                });
                it("minimumReached == true", async () => {
                    expect(await setup.seed.minimumReached()).to.equal(true);
                });
                it("it returns amount of seed token bought and the fee", async () => {
                    let { ["0"]: seedAmount, ["1"]: feeAmount } = await setup.seed.buy.call(buyAmount, {
                        from: buyer1,
                    });
                    expect((await seedAmount).toString()).to.equal(buySeedAmount);
                    expect((await feeAmount).toString()).to.equal(hundredTwoETH);
                });
                it("updates fee mapping for locker", async () => {
                    expect((await setup.seed.funders(buyer1)).fee.toString()).to.equal(hundredTwoETH);
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
                    expect((await setup.seed.fundingCollected()).toString()).to.equal(buyAmount.toString());
                });
                it("it fails on claiming seed tokens if the distribution has not yet finished", async () => {
                    await expectRevert(
                        setup.seed.claim(buyer1, claimAmount, { from: buyer1 }),
                        "Seed: the distribution has not yet finished"
                    );
                });
                it("it returns 0 when calculating claim before vesting starts", async () => {
                    expect(
                        (await setup.seed.calculateClaim(buyer1)).toString()
                    ).to.equal('0');
                });
                it("updates lock when it buys tokens", async () => {
                    let prevSeedAmount = (await setup.seed.funders(buyer1)).seedAmount;
                    let prevFeeAmount = (await setup.seed.funders(buyer1)).fee;

                    let tx = await setup.seed.buy(buyAmount, { from: buyer1 });
                    setup.data.tx = tx;

                    await expectEvent.inTransaction(setup.data.tx.tx, setup.seed, "SeedsPurchased");
                    expect((await fundingToken.balanceOf(setup.seed.address)).toString()).to.equal(
                        (2 * buyAmount).toString()
                    );

                    expect((await setup.seed.funders(buyer1)).seedAmount.toString()).to.equal(
                        prevSeedAmount.mul(twoBN).toString()
                    );
                    expect((await setup.seed.funders(buyer1)).fee.toString()).to.equal(prevFeeAmount.mul(twoBN).toString());
                });
                it("maximumReached == true", async () => {
                    expect(await setup.seed.maximumReached()).to.equal(true);
                });
                it("vestingStartTime == current timestamp", async () => {
                    expect((await setup.seed.vestingStartTime()).toString()).to.equal((await time.latest()).toString());
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
                    expect((await setup.seed.funders(buyer1)).totalClaimed.toString()).to.equal(zero.toString());
                });
            });
        });
        // describe("# claim", () => {
        //     describe("» generics", () => {
        //         it("claim = 0 when not currentTime<endTime", async () => {
        //             expect((await setup.seed.calculateClaim(buyer2)).toString()).to.equal('0');
        //         });
        //         it("it cannot claim before vestingCliff", async () => {
        //             await time.increase(eightyNineDaysInSeconds);
        //             await expectRevert(
        //                 setup.seed.claim(buyer1, claimAmount, { from: buyer1 }),
        //                 "Seed: amount claimable is 0"
        //             );
        //         });
        //         it("calculates correct claim", async () => {
        //             // increase time
        //             await time.increase(tenDaysInSeconds);
        //             const claim = await setup.seed.calculateClaim(buyer1);
        //             const vestingStartTime = await setup.seed.vestingStartTime();
        //             const expectedClaim = (await time.latest())
        //                 .sub(vestingStartTime)
        //                 .mul(new BN(buySeedAmount).mul(twoBN)).div(new BN(vestingDuration));
        //             expect(claim.toString()).to.equal(expectedClaim.toString());
        //         });
        //         it("claim = 0 when not contributed", async () => {
        //             expect((await setup.seed.calculateClaim(buyer2)).toString()).to.equal('0');
        //         });
        //         it("it cannot claim if not vested", async () => {
        //             await expectRevert(
        //                 setup.seed.claim(buyer2, new BN(buySeedAmount).mul(twoBN).add(new BN(one)), { from: buyer1 }),
        //                 "Seed: amount claimable is 0"
        //             );
        //         });
        //         it("it cannot claim more than claimable amount", async () => {
        //             await expectRevert(
        //                 setup.seed.claim(buyer1, new BN(buySeedAmount).mul(twoBN).add(new BN(one)), { from: buyer1 }),
        //                 "Seed: request is greater than claimable amount"
        //             );
        //         });
        //         it("it returns amount of the fee", async () => {
        //             let feeSent = await setup.seed.claim.call(buyer1, claimAmount, {
        //                 from: buyer1,
        //             });
        //             expect(feeSent.toString()).to.equal(feeAmount.toString());
        //         });
        //         it("it withdraws tokens after time passes", async () => {
        //             // claim lock
        //             let tx = await setup.seed.claim(buyer1, claimAmount, { from: buyer1 });
        //             setup.data.tx = tx;

        //             await expectEvent.inTransaction(setup.data.tx.tx, setup.seed, "TokensClaimed", {
        //                 recipient: buyer1,
        //             });
        //         });
        //         it("updates claim", async () => {
        //             expect((await setup.seed.funders(buyer1)).totalClaimed.toString()).to.equal(claimAmount.toString());
        //         });
        //         it("updates fee claimed", async () => {
        //             expect((await setup.seed.funders(buyer1)).feeClaimed.toString()).to.equal(feeAmount.toString());
        //         });
        //         it("funds dao with fee", async () => {
        //             expect((await seedToken.balanceOf(avatar.address)).toString()).to.equal(
        //                 feeAmount.toString()
        //             );
        //         });
        //         it("updates the amount of seed claimed by the claim amount", async () => {
        //             totalClaimedByBuyer1 = claimAmount;
        //             expect((await setup.seed.seedClaimed()).toString()).to.equal(claimAmount.toString());
        //         });
        //         it("updates the amount of seed transfered as fee to beneficiary", async () => {
        //             expect((await setup.seed.feeClaimed()).toString()).to.equal(feeAmount.toString());
        //         });
        //         it("calculates and claims exact seed amount", async () => {
        //             const claim = await setup.seed.calculateClaim(buyer1);
        //             let tx = await setup.seed.claim(buyer1, claim, { from: buyer1 });
        //             setup.data.tx = tx;

        //             totalClaimedByBuyer1 = totalClaimedByBuyer1.add(claim);
        //             const receipt = await expectEvent.inTransaction(setup.data.tx.tx, setup.seed, "TokensClaimed");
        //             expect(await receipt.args[1].toString()).to.equal(claim.toString());
        //         });
        //     });
        //     context("» claim after vesting duration", async () => {
        //         before("!! deploy new contract + top up buyer balance", async () => {
        //             let newStartTime = await time.latest();
        //             let newEndTime = await newStartTime.add(await time.duration.days(7));

        //             setup.data.seed = await Seed.new();

        //             await seedToken.transfer(setup.data.seed.address, requiredSeedAmount, { from: setup.root });
        //             await fundingToken.transfer(accounts[3], await fundingToken.balanceOf(buyer2), { from: buyer2 });
        //             await fundingToken.transfer(buyer2, new BN(buyAmount).mul(twoBN), { from: setup.root });
        //             await fundingToken.approve(setup.data.seed.address, new BN(buyAmount).mul(twoBN), { from: buyer2 });

        //             await setup.data.seed.initialize(
        //                 avatar.address,
        //                 admin,
        //                 [seedToken.address, fundingToken.address],
        //                 [softCap, hardCap],
        //                 price,
        //                 newStartTime,
        //                 newEndTime,
        //                 vestingDuration,
        //                 vestingCliff,
        //                 permissionedSeed,
        //                 fee
        //             );

        //             await setup.data.seed.buy(new BN(buyAmount).mul(twoBN), { from: buyer2 });
        //         });
        //         it("claims all seeds after vesting duration", async () => {
        //             time.increase(await time.duration.days(7));
        //             time.increase(vestingDuration);
        //             setup.data.prevBalance = await seedToken.balanceOf(avatar.address);
        //             let tx = await setup.data.seed.claim(buyer2, new BN(buySeedAmount).mul(twoBN), { from: buyer2 });
        //             setup.data.tx = tx;
        //             const receipt = await expectEvent.inTransaction(setup.data.tx.tx, setup.data.seed, "TokensClaimed");
        //             expect(await receipt.args[1].toString()).to.equal(new BN(buySeedAmount).mul(twoBN).toString());
        //         });
        //         it("it claims all the fee for a buyer's claim", async () => {
        //             const fee = (await setup.data.seed.funders(buyer2)).fee;
        //             const feeClaimed = (await setup.data.seed.funders(buyer2)).feeClaimed;
        //             expect(fee.toString()).to.equal(feeClaimed.toString());
        //         });
        //         it("it claims all the fee", async () => {
        //             const feeAmountRequired = await setup.data.seed.feeAmountRequired();
        //             const feeClaimed = await setup.data.seed.feeClaimed();
        //             expect(feeAmountRequired.toString()).to.equal(feeClaimed.toString());
        //         });
        //         it("funds DAO with all the fee", async () => {
        //             const fee = (await setup.data.seed.funders(buyer2)).fee;
        //             expect((await seedToken.balanceOf(avatar.address)).toString()).to.equal(
        //                 fee.add(setup.data.prevBalance).toString()
        //             );
        //             delete setup.data.prevBalance;
        //         });
        //     });
        //     context("» claim when vesting duration is 0", async () => {
        //         before("!! deploy new contract + top up buyer balance", async () => {
        //             let newStartTime = await time.latest();
        //             let newEndTime = await newStartTime.add(await time.duration.days(7));

        //             setup.data.seed = await Seed.new();

        //             await seedToken.transfer(setup.data.seed.address, requiredSeedAmount, { from: setup.root });
        //             await fundingToken.transfer(accounts[3], await fundingToken.balanceOf(buyer2), { from: buyer2 });
        //             await fundingToken.transfer(buyer2, new BN(buyAmount).mul(twoBN), { from: setup.root });
        //             await fundingToken.approve(setup.data.seed.address, new BN(buyAmount).mul(twoBN), { from: buyer2 });

        //             await setup.data.seed.initialize(
        //                 avatar.address,
        //                 admin,
        //                 [seedToken.address, fundingToken.address],
        //                 [softCap, hardCap],
        //                 price,
        //                 newStartTime,
        //                 newEndTime,
        //                 0,
        //                 0,
        //                 permissionedSeed,
        //                 fee
        //             );

        //             await setup.data.seed.buy(new BN(buyAmount).mul(twoBN), { from: buyer2 });
        //         });
        //         it("claims all seeds after vesting duration", async () => {
        //             setup.data.prevBalance = await seedToken.balanceOf(avatar.address);
        //             let tx = await setup.data.seed.claim(buyer2, new BN(buySeedAmount).mul(twoBN), { from: buyer2 });
        //             setup.data.tx = tx;
        //             const receipt = await expectEvent.inTransaction(setup.data.tx.tx, setup.data.seed, "TokensClaimed");
        //             expect(await receipt.args[1].toString()).to.equal(new BN(buySeedAmount).mul(twoBN).toString());
        //         });
        //         it("it claims all the fee for a buyer's claim", async () => {
        //             const fee = (await setup.data.seed.funders(buyer2)).fee;
        //             const feeClaimed = (await setup.data.seed.funders(buyer2)).feeClaimed;
        //             expect(fee.toString()).to.equal(feeClaimed.toString());
        //         });
        //         it("it claims all the fee", async () => {
        //             const feeAmountRequired = await setup.data.seed.feeAmountRequired();
        //             const feeClaimed = await setup.data.seed.feeClaimed();
        //             expect(feeAmountRequired.toString()).to.equal(feeClaimed.toString());
        //         });
        //         it("funds DAO with all the fee", async () => {
        //             const fee = (await setup.data.seed.funders(buyer2)).fee;
        //             expect((await seedToken.balanceOf(avatar.address)).toString()).to.equal(
        //                 fee.add(setup.data.prevBalance).toString()
        //             );
        //             delete setup.data.prevBalance;
        //         });
        //     });
        // });
        // context("# retrieveFundingTokens", () => {
        //     context("» generics", () => {
        //         before("!! deploy new contract + top up buyer balance", async () => {
        //             let newStartTime = await time.latest();
        //             let newEndTime = await newStartTime.add(await time.duration.days(7));

        //             setup.data.seed = await Seed.new();

        //             await seedToken.transfer(setup.data.seed.address, requiredSeedAmount, { from: setup.root });
        //             await fundingToken.transfer(buyer2, smallBuyAmount, { from: setup.root });
        //             await fundingToken.approve(setup.data.seed.address, smallBuyAmount, { from: buyer2 });

        //             await setup.data.seed.initialize(
        //                 avatar.address,
        //                 admin,
        //                 [seedToken.address, fundingToken.address],
        //                 [softCap, hardCap],
        //                 price,
        //                 newStartTime,
        //                 newEndTime,
        //                 vestingDuration,
        //                 vestingCliff,
        //                 permissionedSeed,
        //                 fee
        //             );

        //             await setup.data.seed.buy(smallBuyAmount, { from: buyer2 });
        //         });
        //         it("it cannot return funding tokens if not bought", async () => {
        //             await expectRevert(
        //                 setup.data.seed.retrieveFundingTokens({ from: buyer1 }),
        //                 "Seed: zero funding amount"
        //             );
        //         });
        //         it("returns funding amount when called", async () => {
        //             const fundingAmount = await setup.data.seed.retrieveFundingTokens.call({ from: buyer2 });
        //             expect((await fundingAmount).toString()).to.equal(smallBuyAmount);
        //         });
        //         it("returns funding tokens to buyer", async () => {
        //             expect((await fundingToken.balanceOf(buyer2)).toString()).to.equal(zero.toString());

        //             let tx = await setup.data.seed.retrieveFundingTokens({ from: buyer2 });
        //             setup.data.tx = tx;

        //             expectEvent.inTransaction(setup.data.tx.tx, setup.data.seed, "FundingReclaimed");
        //             expect((await fundingToken.balanceOf(buyer2)).toString()).to.equal(smallBuyAmount.toString());
        //         });
        //         it("clears `fee` mapping", async () => {
        //             expect((await setup.seed.funders(buyer2)).fee.toString()).to.equal(zero.toString());
        //         });
        //         it("clears `tokenLock.amount`", async () => {
        //             expect((await setup.seed.funders(buyer2)).seedAmount.toString()).to.equal(zero.toString());
        //         });
        //         it("updates `feeRemainder` ", async () => {
        //             expect((await setup.data.seed.feeRemainder()).toString()).to.equal(seedForFee.toString());
        //         });
        //         it("updates remaining seeds", async () => {
        //             expect((await setup.data.seed.seedRemainder()).toString()).to.equal(seedForDistribution.toString());
        //         });
        //         it("updates amount of funding token collected", async () => {
        //             expect((await setup.data.seed.fundingCollected()).toString()).to.equal("0");
        //         });
        //         it("cannot be called once funding minimum is reached", async () => {
        //             await fundingToken.transfer(buyer2, tenETH, { from: setup.root });
        //             await fundingToken.approve(setup.data.seed.address, tenETH, { from: buyer2 });
        //             await setup.data.seed.buy(tenETH, { from: buyer2 });
        //             await expectRevert(
        //                 setup.data.seed.retrieveFundingTokens({ from: buyer2 }),
        //                 "Seed: minimum already met"
        //             );
        //         });
        //     });
        // });
        // context("# close", () => {
        //     context("» generics", () => {
        //         before("!! deploy new contract + top up buyer balance", async () => {
        //             let newStartTime = await time.latest();
        //             let newEndTime = await newStartTime.add(await time.duration.days(7));

        //             setup.data.seed = await Seed.new();

        //             await seedToken.transfer(setup.data.seed.address, requiredSeedAmount, { from: setup.root });

        //             setup.data.seed.initialize(
        //                 avatar.address,
        //                 admin,
        //                 [seedToken.address, fundingToken.address],
        //                 [softCap, hardCap],
        //                 price,
        //                 newStartTime,
        //                 newEndTime,
        //                 vestingDuration,
        //                 vestingCliff,
        //                 permissionedSeed,
        //                 fee
        //             );

        //             await fundingToken.approve(setup.data.seed.address, smallBuyAmount, { from: buyer2 });
        //             await setup.data.seed.buy(smallBuyAmount, { from: buyer2 });
        //         });
        //         it("can only be called by admin", async () => {
        //             await expectRevert(setup.data.seed.close(), "Seed: caller should be admin");
        //         });
        //         it("transfers seed tokens to the admin", async () => {
        //             let stBalance = await seedToken.balanceOf(setup.data.seed.address);
        //             await setup.data.seed.close({ from: admin });
        //             expect((await seedToken.balanceOf(admin)).toString()).to.equal(stBalance.toString());
        //         });
        //         it("paused == false", async () => {
        //             expect(await setup.data.seed.paused()).to.equal(false);
        //         });
        //         it("it cannot buy when closed", async () => {
        //             await expectRevert(setup.data.seed.buy(buyAmount, { from: buyer1 }), "Seed: should not be closed");
        //         });
        //         it("it cannot withdraw when closed", async () => {
        //             await expectRevert(setup.data.seed.withdraw({ from: admin }), "Seed: should not be closed");
        //         });
        //         it("do not transfer funding tokens to the admin", async () => {
        //             let ftBalance = await fundingToken.balanceOf(setup.data.seed.address);
        //             expect((await fundingToken.balanceOf(setup.data.seed.address)).toString()).to.equal(
        //                 ftBalance.toString()
        //             );
        //         });
        //         it("returns funding tokens to buyer", async () => {
        //             expect((await fundingToken.balanceOf(buyer2)).toString()).to.equal(zero.toString());

        //             let tx = await setup.data.seed.retrieveFundingTokens({ from: buyer2 });
        //             setup.data.tx = tx;

        //             expectEvent.inTransaction(setup.data.tx.tx, setup.data.seed, "FundingReclaimed");
        //             expect((await fundingToken.balanceOf(buyer2)).toString()).to.equal(smallBuyAmount.toString());
        //         });
        //     });
        //     context("» close after minimum reached", () => {
        //         before("!! deploy new contract + top up buyer balance", async () => {
        //             let newStartTime = await time.latest();
        //             let newEndTime = await newStartTime.add(await time.duration.days(7));

        //             setup.data.seed = await Seed.new();

        //             await fundingToken.transfer(buyer2, buyAmount, { from: setup.root });
        //             await seedToken.transfer(setup.data.seed.address, requiredSeedAmount, { from: setup.root });

        //             setup.data.seed.initialize(
        //                 avatar.address,
        //                 admin,
        //                 [seedToken.address, fundingToken.address],
        //                 [softCap, hardCap],
        //                 price,
        //                 newStartTime,
        //                 newEndTime,
        //                 vestingDuration,
        //                 vestingCliff,
        //                 permissionedSeed,
        //                 fee
        //             );

        //             await fundingToken.approve(setup.data.seed.address, buyAmount, { from: buyer2 });
        //             await setup.data.seed.buy(buyAmount, { from: buyer2 });
        //         });
        //         it("it refunds only seed amount that are not bought", async () => {
        //             const buyFee = new BN(buySeedAmount)
        //                 .mul(new BN(PPM))
        //                 .mul(new BN(fee))
        //                 .div(new BN(PPM100));
        //             const prevBal = await seedToken.balanceOf(admin);
        //             await setup.data.seed.close({ from: admin });
        //             expect((await seedToken.balanceOf(admin)).toString()).to.equal(
        //                 requiredSeedAmount
        //                     .add(prevBal)
        //                     .sub(new BN(buySeedAmount))
        //                     .sub(buyFee)
        //                     .toString()
        //             );
        //         });
        //         it("paused == false", async () => {
        //             expect(await setup.data.seed.paused()).to.equal(false);
        //         });
        //     });
        // });
        // context("# getter functions", () => {
        //     context("» checkWhitelisted", () => {
        //         it("returns correct bool", async () => {
        //             // default false - contract not whitelist contract
        //             expect(await setup.seed.checkWhitelisted(buyer1)).to.equal(false);
        //         });
        //     });
        //     context("» getAmount", () => {
        //         it("returns correct amount", async () => {
        //             expect((await setup.seed.funders(buyer1)).seedAmount.toString()).to.equal(
        //                 new BN(buySeedAmount).mul(twoBN).toString()
        //             );
        //         });
        //     });
        //     context("» getTotalClaimed", () => {
        //         it("returns correct claimed", async () => {
        //             expect((await setup.seed.funders(buyer1)).totalClaimed.toString()).to.equal(
        //                 totalClaimedByBuyer1.toString()
        //             );
        //         });
        //     });
        //     context("» getFee", () => {
        //         it("returns correct fee", async () => {
        //             let amount = new BN(buySeedAmount);
        //             let amountMinusFee = new BN(amount.mul(twoBN).div(new BN(hundred)));
        //             expect((await setup.seed.funders(buyer1)).fee.toString()).to.equal(amountMinusFee.mul(twoBN).toString());
        //         });
        //     });
        //     context("» getStartTime", () => {
        //         it("returns correct startTime", async () => {
        //             expect((await setup.seed.startTime()).toString()).to.equal(startTime.toString());
        //         });
        //     });
        // });
        // context("# admin functions", () => {
        //     context("» update metadata", () => {
        //         it("can only be called by admin", async () => {
        //             await expectRevert(
        //                 setup.seed.updateMetadata(metadata),
        //                 "Seed: contract should not be initialized or caller should be admin"
        //             );
        //         });
        //         it("updates metadata", async () => {
        //             let tx = await setup.seed.updateMetadata(metadata, { from: admin });
        //             setup.data.tx = tx;

        //             await expectEvent.inTransaction(setup.data.tx.tx, setup.seed, "MetadataUpdated");
        //         });
        //     });
        //     context("» pause", () => {
        //         it("can only be called by admin", async () => {
        //             await expectRevert(setup.seed.pause(), "Seed: caller should be admin");
        //         });
        //         it("pauses contract", async () => {
        //             await setup.seed.pause({ from: admin });
        //             expect(await setup.seed.paused()).to.equal(true);
        //         });
        //         it("it cannot buy when paused", async () => {
        //             await expectRevert(setup.seed.buy(buyAmount, { from: buyer1 }), "Seed: should not be paused");
        //         });
        //         it("it cannot retrieve when paused", async () => {
        //             await expectRevert(
        //                 setup.seed.retrieveFundingTokens({ from: buyer2 }),
        //                 "Seed: should not be paused"
        //             );
        //         });
        //         it("it cannot withdraw when closed", async () => {
        //             await expectRevert(setup.seed.withdraw({ from: admin }), "Seed: should not be paused");
        //         });
        //     });
        //     context("» unpause", () => {
        //         it("can only be called by admin", async () => {
        //             await expectRevert(setup.seed.unpause(), "Seed: caller should be admin");
        //         });
        //         it("unpauses contract", async () => {
        //             await setup.seed.unpause({ from: admin });
        //             expect(await setup.seed.paused()).to.equal(false);
        //         });
        //     });
        //     context("» unwhitelist", () => {
        //         it("can only be called by admin", async () => {
        //             await expectRevert(setup.seed.unwhitelist(buyer1), "Seed: caller should be admin");
        //         });
        //         it("reverts: can only be called on whitelisted contract", async () => {
        //             await expectRevert(
        //                 setup.seed.whitelist(buyer1, { from: admin }),
        //                 "Seed: module is not whitelisted"
        //             );
        //         });
        //     });
        //     context("» whitelist", () => {
        //         it("can only be called by admin", async () => {
        //             await expectRevert(setup.seed.whitelist(buyer1), "Seed: caller should be admin");
        //         });
        //         it("reverts: can only be called on whitelisted contract", async () => {
        //             await expectRevert(
        //                 setup.seed.whitelist(buyer1, { from: admin }),
        //                 "Seed: module is not whitelisted"
        //             );
        //         });
        //     });
        //     context("» withdraw", () => {
        //         before("!! deploy new contract", async () => {
        //             let newStartTime = await time.latest();
        //             let newEndTime = await newStartTime.add(await time.duration.days(7));

        //             setup.data.seed = await Seed.new();

        //             await seedToken.transfer(setup.data.seed.address, requiredSeedAmount, { from: setup.root });
        //             await fundingToken.transfer(buyer2, buyAmount, { from: setup.root });
        //             await fundingToken.approve(setup.data.seed.address, buyAmount, { from: buyer2 });

        //             setup.data.seed.initialize(
        //                 avatar.address,
        //                 admin,
        //                 [seedToken.address, fundingToken.address],
        //                 [softCap, hardCap],
        //                 price,
        //                 newStartTime,
        //                 newEndTime,
        //                 vestingDuration,
        //                 vestingCliff,
        //                 permissionedSeed,
        //                 fee
        //             );
        //         });
        //         it("can not withdraw before minumum funding amount is met", async () => {
        //             await expectRevert(
        //                 setup.data.seed.withdraw({ from: admin }),
        //                 "Seed: minimum funding amount not met"
        //             );
        //         });
        //         it("can withdraw after minimum funding amount is met", async () => {
        //             await setup.data.seed.buy(buyAmount, { from: buyer2 });
        //             await setup.data.seed.withdraw({ from: admin });
        //             expect((await fundingToken.balanceOf(setup.data.seed.address)).toString()).to.equal(
        //                 zero.toString()
        //             );
        //             expect((await fundingToken.balanceOf(admin)).toString()).to.equal(buyAmount);
        //         });
        //         it("updates the amount of funding token withdrawn", async () => {
        //             await expect((await setup.data.seed.fundingWithdrawn()).toString()).to.equal(buyAmount);
        //         });
        //         it("can only be called by admin", async () => {
        //             await expectRevert(setup.seed.withdraw(), "Seed: caller should be admin");
        //         });
        //     });
        // });
    // });
    // context("creator is avatar -- whitelisted contract", () => {
    //     before("!! deploy setup", async () => {
    //         setup = await deploy(accounts);
    //         admin = accounts[1];
    //         buyer1 = accounts[2];
    //         seedToken = setup.tokens.primeToken;
    //         fundingToken = setup.tokens.erc20s[0];
    //         softCap = toWei("10");
    //         hardCap = toWei("102");
    //         price = toWei("0.01");
    //         buyAmount = toWei("51");
    //         startTime = await time.latest();
    //         endTime = await startTime.add(await time.duration.days(7));
    //         vestingDuration = time.duration.days(365); // 1 year
    //         vestingCliff = time.duration.days(90); // 3 months
    //         permissionedSeed = true;
    //         fee = 2;

    //         seedForDistribution = new BN(hardCap).div(new BN(price)).mul(new BN(pct_base));
    //         seedForFee = seedForDistribution
    //             .mul(new BN(PPM))
    //             .mul(new BN(fee))
    //             .div(new BN(PPM100));
    //         requiredSeedAmount = seedForDistribution.add(seedForFee);
    //     });
    //     context("» contract is not initialized yet", () => {
    //         context("» parameters are valid", () => {
    //             before("!! deploy new contract", async () => {
    //                 seed = await Seed.new();
    //             });
    //             it("initializes", async () => {
    //                 // emulate creation & initialization via seedfactory & fund with seedTokens
    //                 await seedToken.transfer(seed.address, requiredSeedAmount, { from: setup.root });

    //                 await seed.initialize(
    //                     avatar.address,
    //                     admin,
    //                     [seedToken.address, fundingToken.address],
    //                     [softCap, hardCap],
    //                     price,
    //                     startTime,
    //                     endTime,
    //                     vestingDuration,
    //                     vestingCliff,
    //                     permissionedSeed,
    //                     fee
    //                 );

    //                 expect(await seed.initialized()).to.equal(true);
    //                 expect(await seed.beneficiary()).to.equal(avatar.address);
    //                 expect(await seed.admin()).to.equal(admin);
    //                 expect(await seed.seedToken()).to.equal(seedToken.address);
    //                 expect(await seed.fundingToken()).to.equal(fundingToken.address);
    //                 expect((await seed.softCap()).toString()).to.equal(softCap);
    //                 expect((await seed.price()).toString()).to.equal(price);
    //                 expect(await seed.permissionedSeed()).to.equal(permissionedSeed);
    //                 expect((await seed.fee()).toString()).to.equal(fee.toString());
    //                 expect(await seed.closed()).to.equal(false);
    //                 expect((await seed.seedAmountRequired()).toString()).to.equal(seedForDistribution.toString());
    //                 expect((await seed.feeAmountRequired()).toString()).to.equal(seedForFee.toString());
    //                 expect((await seed.seedRemainder()).toString()).to.equal(seedForDistribution.toString());
    //                 expect((await seed.feeRemainder()).toString()).to.equal(seedForFee.toString());
    //                 expect((await seedToken.balanceOf(seed.address)).toString()).to.equal(
    //                     requiredSeedAmount.toString()
    //                 );
    //             });
    //             it("it reverts on double initialization", async () => {
    //                 await expectRevert(
    //                     seed.initialize(
    //                         avatar.address,
    //                         admin,
    //                         [seedToken.address, fundingToken.address],
    //                         [softCap, hardCap],
    //                         price,
    //                         startTime,
    //                         endTime,
    //                         vestingDuration,
    //                         vestingCliff,
    //                         permissionedSeed,
    //                         fee
    //                     ),
    //                     "Seed: contract already initialized"
    //                 );
    //             });
    //         });
    //     });
    //     context("# admin whitelist functions", () => {
    //         context("» whitelist", () => {
    //             it("adds a user to the whitelist", async () => {
    //                 expect(await seed.checkWhitelisted(buyer1)).to.equal(false);
    //                 await seed.whitelist(buyer1, { from: admin });
    //                 expect(await seed.checkWhitelisted(buyer1)).to.equal(true);
    //             });
    //         });
    //         context("» unwhitelist", () => {
    //             it("removes a user from the whitelist", async () => {
    //                 expect(await seed.checkWhitelisted(buyer1)).to.equal(true);
    //                 await seed.unwhitelist(buyer1, { from: admin });
    //                 expect(await seed.checkWhitelisted(buyer1)).to.equal(false);
    //             });
    //         });
    //         context("» whitelistBatch", () => {
    //             it("can only be called by admin", async () => {
    //                 await expectRevert(seed.whitelistBatch([buyer1, buyer2]), "Seed: caller should be admin");
    //             });
    //             it("adds users to the whitelist", async () => {
    //                 expect(await seed.checkWhitelisted(accounts[4])).to.equal(false);
    //                 expect(await seed.checkWhitelisted(accounts[5])).to.equal(false);

    //                 await seed.whitelistBatch([accounts[4], accounts[5]], { from: admin });

    //                 expect(await seed.checkWhitelisted(accounts[4])).to.equal(true);
    //                 expect(await seed.checkWhitelisted(accounts[5])).to.equal(true);
    //             });
    //         });
    //     });
    //     context("# hardCap", () => {
    //         context("» check hardCap", () => {
    //             it("cannot buy more than hardCap", async () => {
    //                 await fundingToken.transfer(buyer2, hundredTwoETH, { from: setup.root });
    //                 await fundingToken.approve(seed.address, hundredTwoETH, { from: buyer2 });
    //                 await seed.whitelist(buyer2, { from: admin });
    //                 await seed.buy(hundredTwoETH, { from: buyer2 });
    //                 await expectRevert(seed.buy(twoHundredFourETH, { from: buyer2 }), "Seed: maximum funding reached");
    //             });
    //         });
    //     });
    });
});
