const {expect} = require('chai');
const { ethers } = require("hardhat");
const { time, expectRevert, BN, expectEvent } = require('@openzeppelin/test-helpers');
const { parseEther } = ethers.utils

const init = require("../test-init.js");

const deploy = async () => {
    const setup = await init.initialize(await ethers.getSigners());;

    setup.seed = await init.seedMasterCopy(setup);

    setup.token = await init.tokens(setup);

    setup.data = {};

    return setup;
}

describe('>> Deploy a new seed contract', async () => {
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

    let nonce = 0;
    
    // constants
    const zero    = 0;
    const one     = 1;
    const hundred = 100;
    const PPM     = 1000000;
    const PPM100  = 100000000;
    const tenETH            = parseEther('10').toString();
    const hundredTwoETH     = parseEther('102').toString();
    const twoHundredFourETH = parseEther('204').toString();
    const twoBN    = new BN(2);
    const pct_base = ethers.constants.WeiPerEther
    const ninetyTwoDaysInSeconds  = time.duration.days(92);
    const eightyNineDaysInSeconds = time.duration.days(89);
    const tenDaysInSeconds      = time.duration.days(10);

    describe("» creator is avatar", () => {
        before('!! setup', async () => {
            setup = await deploy();
        
            // Tokens used
            fundingToken = setup.token.fundingToken;
            seedToken = setup.token.seedToken;
            
            // // Roles
            root = setup.roles.root;
            beneficiary = setup.roles.beneficiary;
            admin = setup.roles.prime; //check of dit klopt
            buyer1 = setup.roles.buyer1;
            buyer2 = setup.roles.buyer2;
            buyer3 = setup.roles.buyer3;

            // // Parameters to initialize seed contract
            softCap        = parseEther("10").toString();
            hardCap        = parseEther("102").toString();
            price          = parseEther("0.01").toString();
            buyAmount      = parseEther("51").toString();
            smallBuyAmount = parseEther("9").toString();
            buySeedAmount  = parseEther("5100").toString();
            startTime = await time.latest();
            endTime   = await startTime.add(await time.duration.days(7));
            vestingDuration = time.duration.days(365); // 1 year
            vestingCliff    = time.duration.days(90); // 3 months
            permissionedSeed = false;
            fee = 2;
            metadata = `0x`;

            buySeedFee = new BN(buySeedAmount)
            .mul(new BN(PPM))
            .mul(new BN(fee))
            .div(new BN(PPM100));
            seedForDistribution = new BN(hardCap).div(new BN(price)).mul(new BN(pct_base.toString()));
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
        describe("# buy", () => {
            describe("» generics", () => {
                before("!! top up buyer1 balance", async () => {
                    await fundingToken.connect(root).transfer(buyer1.address, hundredTwoETH);
                    await fundingToken.connect(buyer1).approve(setup.seed.address, hundredTwoETH);
                    
                    claimAmount = new BN(ninetyTwoDaysInSeconds).mul(
                        new BN(buySeedAmount).mul(new BN(twoBN)).div(new BN(vestingDuration))
                    );
                    feeAmount = new BN(claimAmount)
                        .mul(new BN(PPM))
                        .mul(new BN(fee))
                        .div(new BN(PPM100));
                });
                it("it cannot buy if not funded", async () => {
                    await expectRevert(
                        setup.seed.connect(buyer1).buy(buyAmount),
                        "Seed: sufficient seeds not provided"
                    );
                });
                it("it funds the Seed contract with Seed Token", async () => {
                    await seedToken.connect(root).transfer(
                        setup.seed.address, requiredSeedAmount.toString());
                    expect((await seedToken.balanceOf(setup.seed.address)).toString()).to.equal(
                        requiredSeedAmount.toString()
                    );
                });
                it("it cannot buy when paused", async () => {
                    await setup.seed.connect(admin).pause();
                    await expectRevert(
                        setup.seed.connect(buyer1).buy(buyAmount), "Seed: should not be paused");
                    await setup.seed.connect(admin).unpause();
                });
                it("it cannot buy 0 seeds", async () => {
                    await expectRevert(
                        setup.seed.connect(buyer1).buy(zero.toString()),
                        "Seed: amountVestedPerSecond > 0"
                    );
                });
                it("it buys tokens ", async () => {
                    console.log(">>>>> Error with expectEvent.inTransition")
                    let tx = await setup.seed.connect(buyer1).buy(buyAmount);
                    setup.data.tx = tx;
                    // await expectEvent.inTransaction(setup.data.tx, setup.seed, "SeedsPurchased");
                    // expect((await fundingToken.balanceOf(setup.seed.address)).toString()).to.equal(
                    //     ((buySeedAmount * price) / pct_base).toString()
                    // );
                });
                it("minimumReached == true", async () => {
                    expect(await setup.seed.minimumReached()).to.equal(true);
                });
                it("it returns amount of seed token bought and the fee", async () => {
                    let { ["0"]: seedAmount, ["1"]: feeAmount } = await setup.seed.connect(
                        buyer1).callStatic.buy(buyAmount);
                    expect((await seedAmount).toString()).to.equal(buySeedAmount);
                    expect((await feeAmount).toString()).to.equal(hundredTwoETH);
                });
                it("updates fee mapping for locker", async () => {
                    expect((await setup.seed.funders(
                        buyer1.address)).fee.toString()).to.equal(hundredTwoETH);
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
                        setup.seed.connect(buyer1).claim(buyer1.address, claimAmount.toString()),
                        "Seed: the distribution has not yet finished"
                    );
                });
                it("it returns 0 when calculating claim before vesting starts", async () => {
                    expect(
                        (await setup.seed.calculateClaim(buyer1.address)).toString()
                    ).to.equal('0');
                });
                it("updates lock when it buys tokens", async () => {
                    console.log(">>>>> Error with expectEvent.inTransition")
                    let prevSeedAmount = (await setup.seed.funders(buyer1.address)).seedAmount;
                    let prevFeeAmount = (await setup.seed.funders(buyer1.address)).fee;

                    let tx = await setup.seed.connect(buyer1).buy(buyAmount);
                    setup.data.tx = tx;

                    // await expectEvent.inTransaction(setup.data.tx.tx, setup.seed, "SeedsPurchased");
                    // expect((await fundingToken.balanceOf(setup.seed.address)).toString()).to.equal(
                    //     (2 * buyAmount).toString()
                    // );

                    expect((await setup.seed.funders(buyer1.address)).seedAmount.toString()).to.equal(
                        prevSeedAmount.mul(twoBN.toNumber()).toString()
                    );
                    expect((await setup.seed.funders(buyer1.address)).fee.toString()).to.equal(prevFeeAmount.mul(twoBN.toNumber()).toString());
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
                    expect((await setup.seed.funders(
                        buyer1.address)).totalClaimed.toString()).to.equal(zero.toString());
                });
            });
        });
        describe("# claim", () => {
            describe("» generics", () => {
                it("claim = 0 when not currentTime<endTime", async () => {
                    expect((await setup.seed.calculateClaim(buyer2.address)).toString()).to.equal('0');
                });
                it("it cannot claim before vestingCliff", async () => {
                    await time.increase(eightyNineDaysInSeconds);
                    await expectRevert(
                        setup.seed.connect(buyer1).claim(buyer1.address, claimAmount.toString()),
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
                        .mul(new BN(buySeedAmount).mul(new BN(twoBN))).div(new BN(vestingDuration));
                    expect(claim.toString()).to.equal(expectedClaim.toString());
                });
                it("claim = 0 when not contributed", async () => {
                    expect((await setup.seed.calculateClaim(buyer2.address)).toString()).to.equal('0');
                });
                it("it cannot claim if not vested", async () => {
                    await expectRevert(
                        setup.seed.connect(buyer1).claim(buyer2.address, (new BN(buySeedAmount).mul(new BN(twoBN)).add(new BN(one))).toString()),
                        "Seed: amount claimable is 0"
                    );
                });
                it("it cannot claim more than claimable amount", async () => {
                    await expectRevert(
                        setup.seed.connect(buyer1).claim(buyer1.address, (new BN(buySeedAmount).mul(new BN(twoBN)).add(new BN(one))).toString()),
                        "Seed: request is greater than claimable amount"
                    );
                });
                it("it returns amount of the fee", async () => {
                    let feeSent = await setup.seed.connect(buyer1).callStatic.claim(buyer1.address, claimAmount.toString());
                    expect(feeSent.toString()).to.equal(feeAmount.toString());
                });
                it("it withdraws tokens after time passes", async () => {
                    // claim lock
                    console.log(">>>>> Error with expectEvent.inTransition")
                    let tx = await setup.seed.connect(buyer1).claim(buyer1.address, claimAmount.toString());
                    setup.data.tx = tx;

                    // await expectEvent.inTransaction(setup.data.tx.tx, setup.seed, "TokensClaimed", {
                    //     recipient: buyer1,
                    // });
                });
                it("updates claim", async () => {
                    expect((await setup.seed.funders(buyer1.address)).totalClaimed.toString()).to.equal(claimAmount.toString());
                });
                it("updates fee claimed", async () => {
                    expect((await setup.seed.funders(buyer1.address)).feeClaimed.toString()).to.equal(feeAmount.toString());
                });
                it("funds dao with fee", async () => {
                    expect((await seedToken.balanceOf(beneficiary.address)).toString()).to.equal(
                        feeAmount.toString()
                    );
                });
                it("updates the amount of seed claimed by the claim amount", async () => {
                    totalClaimedByBuyer1 = claimAmount;
                    expect((await setup.seed.seedClaimed()).toString()).to.equal(claimAmount.toString());
                });
                it("updates the amount of seed transfered as fee to beneficiary", async () => {
                    expect((await setup.seed.feeClaimed()).toString()).to.equal(feeAmount.toString());
                });
                it("calculates and claims exact seed amount", async () => {
                    const claim = await setup.seed.calculateClaim(buyer1.address);
                    let tx = await setup.seed.connect(buyer1).claim(buyer1.address, claim);
                    setup.data.tx = tx;

                    totalClaimedByBuyer1 = totalClaimedByBuyer1.add(new BN(claim.toString()));
                console.log(">>>>> Error with expectEvent.inTransition")

                    // const receipt = await expectEvent.inTransaction(setup.data.tx.tx, setup.seed, "TokensClaimed");
                    // expect(await receipt.args[1].toString()).to.equal(claim.toString());
                });
            });                    
            describe("» claim after vesting duration", async () => {
                before("!! deploy new contract + top up buyer balance", async () => {
                    let newStartTime = await time.latest();
                    let newEndTime = await newStartTime.add(await time.duration.days(7));

                    setup.data.seed = await init.seedMasterCopy(setup);

                    await seedToken.connect(root).transfer(setup.data.seed.address, requiredSeedAmount.toString());
                    await fundingToken.connect(buyer2).transfer(buyer3.address, await fundingToken.balanceOf(buyer2.address));
                    await fundingToken.connect(root).transfer(buyer2.address, (new BN(buyAmount).mul(new BN(twoBN))).toString());
                    await fundingToken.connect(buyer2).approve(setup.data.seed.address, (new BN(buyAmount).mul(new BN(twoBN))).toString());

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

                    await setup.data.seed.connect(buyer2).buy((new BN(buyAmount).mul(new BN(twoBN))).toString());
                });
                it("claims all seeds after vesting duration", async () => {
                    console.log(">>>>> Error with expectEvent.inTransition")
                    time.increase(await time.duration.days(7));
                    time.increase(vestingDuration.toNumber());
                    setup.data.prevBalance = await seedToken.balanceOf(beneficiary.address);
                    let tx = await setup.data.seed.connect(buyer2).claim(buyer2.address, (new BN(buySeedAmount).mul(new BN(twoBN))).toString());
                    setup.data.tx = tx;
                    // const receipt = await expectEvent.inTransaction(setup.data.tx.tx, setup.data.seed, "TokensClaimed");
                    // expect(await receipt.args[1].toString()).to.equal(new BN(buySeedAmount).mul(new BN(twoBN)).toString());
                });
                it("it claims all the fee for a buyer's claim", async () => {
                    const fee = (await setup.data.seed.funders(buyer2.address)).fee;
                    const feeClaimed = (await setup.data.seed.funders(buyer2.address)).feeClaimed;
                    expect(fee.toString()).to.equal(feeClaimed.toString());
                });
                it("it claims all the fee", async () => {
                    const feeAmountRequired = await setup.data.seed.feeAmountRequired();
                    const feeClaimed = await setup.data.seed.feeClaimed();
                    expect(feeAmountRequired.toString()).to.equal(feeClaimed.toString());
                });
                it("funds DAO with all the fee", async () => {
                    const fee = (await setup.data.seed.funders(buyer2.address)).fee;
                    expect((await seedToken.balanceOf(beneficiary.address)).toString()).to.equal(
                        fee.add(setup.data.prevBalance).toString()
                    );
                    delete setup.data.prevBalance;
                });
            });
            describe("» claim when vesting duration is 0", async () => {
                before("!! deploy new contract + top up buyer balance", async () => {
                    let newStartTime = await time.latest();
                    let newEndTime = await newStartTime.add(await time.duration.days(7));

                    setup.data.seed = await init.seedMasterCopy(setup);

                    await seedToken.connect(root).transfer(setup.data.seed.address, requiredSeedAmount.toString());
                    await fundingToken.connect(buyer2).transfer(buyer3.address, await fundingToken.balanceOf(buyer2.address));
                    await fundingToken.connect(root).transfer(buyer2.address, (new BN(buyAmount).mul(new BN(twoBN))).toString());
                    await fundingToken.connect(buyer2).approve(setup.data.seed.address, (new BN(buyAmount).mul(new BN(twoBN))).toString());

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

                    await setup.data.seed.connect(buyer2).buy((new BN(buyAmount).mul(new BN(twoBN))).toString());
                });
                it("claims all seeds after vesting duration", async () => {
                    console.log(">>>>> Error with expectEvent.inTransition")
                    setup.data.prevBalance = await seedToken.balanceOf(beneficiary.address);
                    let tx = await setup.data.seed.connect(buyer2).claim(buyer2.address, (new BN(buySeedAmount).mul(new BN(twoBN))).toString());
                    setup.data.tx = tx;
                    // const receipt = await expectEvent.inTransaction(setup.data.tx.tx, setup.data.seed, "TokensClaimed");
                    // expect(await receipt.args[1].toString()).to.equal(new BN(buySeedAmount).mul(twoBN).toString());
                });
                it("it claims all the fee for a buyer's claim", async () => {
                    const fee = (await setup.data.seed.funders(buyer2.address)).fee;
                    const feeClaimed = (await setup.data.seed.funders(buyer2.address)).feeClaimed;
                    expect(fee.toString()).to.equal(feeClaimed.toString());
                });
                it("it claims all the fee", async () => {
                    const feeAmountRequired = await setup.data.seed.feeAmountRequired();
                    const feeClaimed = await setup.data.seed.feeClaimed();
                    expect(feeAmountRequired.toString()).to.equal(feeClaimed.toString());
                });
                it("funds DAO with all the fee", async () => {
                    const fee = (await setup.data.seed.funders(buyer2.address)).fee;
                    expect((await seedToken.balanceOf(beneficiary.address)).toString()).to.equal(
                        fee.add(setup.data.prevBalance).toString()
                    );
                    delete setup.data.prevBalance;
                });
            });
        });
        describe("# retrieveFundingTokens", () => {
            describe("» generics", () => {
                before("!! deploy new contract + top up buyer balance", async () => {
                    let newStartTime = await time.latest();
                    let newEndTime = await newStartTime.add(await time.duration.days(7));

                    setup.data.seed = await init.seedMasterCopy(setup);

                    await seedToken.connect(root).transfer(setup.data.seed.address, requiredSeedAmount.toString());
                    await fundingToken.connect(root).transfer(buyer2.address, smallBuyAmount);
                    await fundingToken.connect(buyer2).approve(setup.data.seed.address, smallBuyAmount);

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
                    const fundingAmount = await setup.data.seed.connect(buyer2).callStatic.retrieveFundingTokens();
                    expect((await fundingAmount).toString()).to.equal(smallBuyAmount);
                });
                it("returns funding tokens to buyer", async () => {
                    console.log(">>>>> Error with expectEvent.inTransition")
                    expect((await fundingToken.balanceOf(buyer2.address)).toString()).to.equal(zero.toString());

                    let tx = await setup.data.seed.connect(buyer2).retrieveFundingTokens();
                    setup.data.tx = tx;

                    // expectEvent.inTransaction(setup.data.tx.tx, setup.data.seed, "FundingReclaimed");
                    // expect((await fundingToken.balanceOf(buyer2)).toString()).to.equal(smallBuyAmount.toString());
                });
                it("clears `fee` mapping", async () => {
                    expect((await setup.data.seed.funders(buyer2.address)).fee.toString()).to.equal(zero.toString());
                });
                it("clears `tokenLock.amount`", async () => {
                    expect((await setup.data.seed.funders(buyer2.address)).seedAmount.toString()).to.equal(zero.toString());
                });
                it("updates `feeRemainder` ", async () => {
                    expect((await setup.data.seed.feeRemainder()).toString()).to.equal(seedForFee.toString());
                });
                it("updates remaining seeds", async () => {
                    expect((await setup.data.seed.seedRemainder()).toString()).to.equal(seedForDistribution.toString());
                });
                it("updates amount of funding token collected", async () => {
                    expect((await setup.data.seed.fundingCollected()).toString()).to.equal("0");
                });
                it("cannot be called once funding minimum is reached", async () => {
                    await fundingToken.connect(root).transfer(buyer2.address, tenETH);
                    await fundingToken.connect(buyer2).approve(setup.data.seed.address, tenETH);
                    await setup.data.seed.connect(buyer2).buy(tenETH);
                    await expectRevert(
                        setup.data.seed.connect(buyer2).retrieveFundingTokens(),
                        "Seed: minimum already met"
                    );
                });
            });
        });
        describe("# close", () => {
            describe("» generics", () => {
                before("!! deploy new contract + top up buyer balance", async () => {
                    let newStartTime = await time.latest();
                    let newEndTime = await newStartTime.add(await time.duration.days(7));

                    setup.data.seed = await init.seedMasterCopy(setup);

                    await seedToken.connect(root).transfer(setup.data.seed.address, requiredSeedAmount.toString());

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

                    await fundingToken.connect(buyer2).approve(setup.data.seed.address, smallBuyAmount);
                    await setup.data.seed.connect(buyer2).buy(smallBuyAmount);
                });
                it("can only be called by admin", async () => {
                    console.log(">>>>> Double check pls - only by admin")
                    await expectRevert(setup.data.seed.connect(buyer1).close(), "Seed: caller should be admin");
                });
                it("transfers seed tokens to the admin", async () => {
                    let stBalance = await seedToken.balanceOf(setup.data.seed.address);
                    await setup.data.seed.connect(admin).close();
                    expect((await seedToken.balanceOf(admin.address)).toString()).to.equal(stBalance.toString());
                });
                it("paused == false", async () => {
                    expect(await setup.data.seed.paused()).to.equal(false);
                });
                it("it cannot buy when closed", async () => {
                    await expectRevert(setup.data.seed.connect(buyer1).buy(buyAmount), "Seed: should not be closed");
                });
                it("it cannot withdraw when closed", async () => {
                    await expectRevert(setup.data.seed.connect(admin).withdraw(), "Seed: should not be closed");
                });
                it("do not transfer funding tokens to the admin", async () => {
                    let ftBalance = await fundingToken.balanceOf(setup.data.seed.address);
                    expect((await fundingToken.balanceOf(setup.data.seed.address)).toString()).to.equal(
                        ftBalance.toString()
                    );
                });
                it("returns funding tokens to buyer", async () => {
                    console.log(">>>>> Error with expectEvent.inTransition")

                    expect((await fundingToken.balanceOf(buyer2.address)).toString()).to.equal(zero.toString());

                    let tx = await setup.data.seed.connect(buyer2).retrieveFundingTokens();
                    setup.data.tx = tx;

                    // expectEvent.inTransaction(setup.data.tx.tx, setup.data.seed, "FundingReclaimed");
                    // expect((await fundingToken.balanceOf(buyer2)).toString()).to.equal(smallBuyAmount.toString());
                });
            });
            describe("» close after minimum reached", () => {
                before("!! deploy new contract + top up buyer balance", async () => {
                    let newStartTime = await time.latest();
                    let newEndTime = await newStartTime.add(await time.duration.days(7));

                    setup.data.seed = await init.seedMasterCopy(setup);

                    await fundingToken.connect(root).transfer(buyer2.address, buyAmount.toString());
                    await seedToken.connect(root).transfer(setup.data.seed.address, requiredSeedAmount.toString());

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

                    await fundingToken.connect(buyer2).approve(setup.data.seed.address, buyAmount);
                    await setup.data.seed.connect(buyer2).buy(buyAmount);
                });
                it("it refunds only seed amount that are not bought", async () => {
                    const buyFee = new BN(buySeedAmount)
                        .mul(new BN(PPM))
                        .mul(new BN(fee))
                        .div(new BN(PPM100));
                    const prevBal = await seedToken.balanceOf(admin.address);
                    await setup.data.seed.connect(admin).close();
                    expect((await seedToken.balanceOf(admin.address)).toString()).to.equal(
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
        });
        describe("# getter functions", () => {
            describe("» checkWhitelisted", () => {
                it("returns correct bool", async () => {
                    // default false - contract not whitelist contract
                    expect(await setup.seed.checkWhitelisted(buyer1.address)).to.equal(false);
                });
            });
            describe("» getAmount", () => {
                it("returns correct amount", async () => {
                    expect((await setup.seed.funders(buyer1.address)).seedAmount.toString()).to.equal(
                        new BN(buySeedAmount).mul(new BN(twoBN)).toString()
                    );
                });
            });
            describe("» getTotalClaimed", () => {
                it("returns correct claimed", async () => {
                    expect((await setup.seed.funders(buyer1.address)).totalClaimed.toString()).to.equal(
                        totalClaimedByBuyer1.toString()
                    );
                });
            });
            describe("» getFee", () => {
                it("returns correct fee", async () => {
                    let amount = new BN(buySeedAmount);
                    let amountMinusFee = new BN(amount.mul(twoBN).div(new BN(hundred)));
                    expect((await setup.seed.funders(buyer1.address)).fee.toString()).to.equal(amountMinusFee.mul(twoBN).toString());
                });
            });
            describe("» getStartTime", () => {
                it("returns correct startTime", async () => {
                    expect((await setup.seed.startTime()).toString()).to.equal(startTime.toString());
                });
            });
        });
        describe("# admin functions", () => {
            describe("» update metadata", () => {
                it("can only be called by admin", async () => {
                    console.log(">>>>> Double check pls - only by admin")
                    await expectRevert(
                        setup.seed.connect(buyer1).updateMetadata(metadata),
                        "Seed: contract should not be initialized or caller should be admin"
                    );
                });
                it("updates metadata", async () => {
                    let tx = await setup.seed.connect(admin).updateMetadata(metadata);
                    setup.data.tx = tx;
                    console.log(">>>>> Error with expectEvent.inTransition")

                    // await expectEvent.inTransaction(setup.data.tx.tx, setup.seed, "MetadataUpdated");
                });
            });
            describe("» pause", () => {
                it("can only be called by admin", async () => {
                    console.log(">>>>> Double check pls - only by admin")
                    await expectRevert(setup.seed.connect(buyer1).pause(), "Seed: caller should be admin");
                });
                it("pauses contract", async () => {
                    await setup.seed.connect(admin).pause();
                    expect(await setup.seed.paused()).to.equal(true);
                });
                it("it cannot buy when paused", async () => {
                    await expectRevert(setup.seed.connect(buyer1).buy(buyAmount), "Seed: should not be paused");
                });
                it("it cannot retrieve when paused", async () => {
                    await expectRevert(
                        setup.seed.connect(buyer2).retrieveFundingTokens(),
                        "Seed: should not be paused"
                    );
                });
                it("it cannot withdraw when closed", async () => {
                    await expectRevert(setup.seed.connect(admin).withdraw(), "Seed: should not be paused");
                });
            });
            describe("» unpause", () => {
                it("can only be called by admin", async () => {
                    console.log(">>>>> Double check pls - only by admin")
                    await expectRevert(setup.seed.connect(buyer1).unpause(), "Seed: caller should be admin");
                });
                it("unpauses contract", async () => {
                    await setup.seed.connect(admin).unpause();
                    expect(await setup.seed.paused()).to.equal(false);
                });
            });
            describe("» unwhitelist", () => {
                it("can only be called by admin", async () => {
                    console.log(">>>>> Double check pls - only by admin")
                    await expectRevert(setup.seed.connect(buyer1).unwhitelist(buyer1.address), "Seed: caller should be admin");
                });
                it("reverts: can only be called on whitelisted contract", async () => {
                    await expectRevert(
                        setup.seed.connect(admin).whitelist(buyer1.address),
                        "Seed: module is not whitelisted"
                    );
                });
            });
            describe("» whitelist", () => {
                it("can only be called by admin", async () => {
                    console.log(">>>>> Double check pls - only by admin")
                    await expectRevert(setup.seed.connect(buyer1).whitelist(buyer1.address), "Seed: caller should be admin");
                });
                it("reverts: can only be called on whitelisted contract", async () => {
                    await expectRevert(
                        setup.seed.connect(admin).whitelist(buyer1.address),
                        "Seed: module is not whitelisted"
                    );
                });
            });
            describe("» withdraw", () => {
                before("!! deploy new contract", async () => {
                    let newStartTime = await time.latest();
                    let newEndTime = await newStartTime.add(await time.duration.days(7));

                    setup.data.seed = await init.seedMasterCopy(setup);

                    await seedToken.connect(root).transfer(setup.data.seed.address, requiredSeedAmount.toString());
                    await fundingToken.connect(root).transfer(buyer2.address, buyAmount.toString());
                    await fundingToken.connect(buyer2).approve(setup.data.seed.address, buyAmount.toString());

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
                        "Seed: minimum funding amount not met"
                    );
                });
                it("can withdraw after minimum funding amount is met", async () => {
                    await setup.data.seed.connect(buyer2).buy(buyAmount);
                    await setup.data.seed.connect(admin).withdraw();
                    expect((await fundingToken.balanceOf(setup.data.seed.address)).toString()).to.equal(
                        zero.toString()
                    );
                    expect((await fundingToken.balanceOf(admin.address)).toString()).to.equal(buyAmount);
                });
                it("updates the amount of funding token withdrawn", async () => {
                    await expect((await setup.data.seed.fundingWithdrawn()).toString()).to.equal(buyAmount);
                });
                it("can only be called by admin", async () => {
                    console.log(">>>>> Double check pls - only by admin")
                    await expectRevert(setup.seed.connect(buyer1).withdraw(), "Seed: caller should be admin");
                });
            });
        });
    });
    describe("creator is avatar -- whitelisted contract", () => {
        before("!! deploy setup", async () => {
            setup = await deploy();
        
            // Tokens used
            fundingToken = setup.token.fundingToken;
            seedToken = setup.token.seedToken;
            
            // // Roles
            root = setup.roles.root;
            beneficiary = setup.roles.beneficiary;
            admin = setup.roles.prime; //check of dit klopt
            buyer1 = setup.roles.buyer1;
            buyer2 = setup.roles.buyer2;
            buyer3 = setup.roles.buyer3;
            buyer4 = setup.roles.buyer3

            // // Parameters to initialize seed contract
            softCap        = parseEther("10").toString();
            hardCap        = parseEther("102").toString();
            price          = parseEther("0.01").toString();
            buyAmount      = parseEther("51").toString();
            startTime = await time.latest();
            endTime = await startTime.add(await time.duration.days(7));
            vestingDuration = time.duration.days(365); // 1 year
            vestingCliff = time.duration.days(90); // 3 months
            permissionedSeed = true;
            fee = 2;

            seedForDistribution = new BN(hardCap).div(new BN(price)).mul(new BN(pct_base.toString()));
            seedForFee = seedForDistribution
                .mul(new BN(PPM))
                .mul(new BN(fee))
                .div(new BN(PPM100));
            requiredSeedAmount = seedForDistribution.add(seedForFee);
        });
        describe("» contract is not initialized yet", () => {
            describe("» parameters are valid", () => {
                before("!! deploy new contract", async () => {
                    seed = await init.seedMasterCopy(setup);
                });
                it("initializes", async () => {
                    // emulate creation & initialization via seedfactory & fund with seedTokens
                    await seedToken.connect(root).transfer(seed.address, requiredSeedAmount.toString());

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
                    expect(await seed.admin()).to.equal(admin);
                    expect(await seed.seedToken()).to.equal(seedToken.address);
                    expect(await seed.fundingToken()).to.equal(fundingToken.address);
                    expect((await seed.softCap()).toString()).to.equal(softCap);
                    expect((await seed.price()).toString()).to.equal(price);
                    expect(await seed.permissionedSeed()).to.equal(permissionedSeed);
                    expect((await seed.fee()).toString()).to.equal(fee.toString());
                    expect(await seed.closed()).to.equal(false);
                    expect((await seed.seedAmountRequired()).toString()).to.equal(seedForDistribution.toString());
                    expect((await seed.feeAmountRequired()).toString()).to.equal(seedForFee.toString());
                    expect((await seed.seedRemainder()).toString()).to.equal(seedForDistribution.toString());
                    expect((await seed.feeRemainder()).toString()).to.equal(seedForFee.toString());
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
        describe("# admin whitelist functions", () => {
            describe("» whitelist", () => {
                it("adds a user to the whitelist", async () => {
                    expect(await seed.checkWhitelisted(buyer1.address)).to.equal(false);
                    await seed.connect(admin).whitelist(buyer1.address);
                    expect(await seed.checkWhitelisted(buyer1.address)).to.equal(true);
                });
            });
            describe("» unwhitelist", () => {
                it("removes a user from the whitelist", async () => {
                    expect(await seed.checkWhitelisted(buyer1.address)).to.equal(true);
                    await seed.connect(admin).unwhitelist(buyer1.address);
                    expect(await seed.checkWhitelisted(buyer1.address)).to.equal(false);
                });
            });
            describe("» whitelistBatch", () => {
                it("can only be called by admin", async () => {
                    console.log(">>>>> Double check pls - only by admin")
                    await expectRevert(seed.connect(buyer1).whitelistBatch([buyer1.address, buyer2.address]), "Seed: caller should be admin");
                });
                it("adds users to the whitelist", async () => {
                    expect(await seed.checkWhitelisted(buyer3.address)).to.equal(false);
                    expect(await seed.checkWhitelisted(buyer4.address)).to.equal(false);

                    await seed.connect(admin).whitelistBatch([buyer3.address, buyer4.address]);

                    expect(await seed.checkWhitelisted(buyer3.address)).to.equal(true);
                    expect(await seed.checkWhitelisted(buyer4.address)).to.equal(true);
                });
            });
        });
        describe("# hardCap", () => {
            describe("» check hardCap", () => {
                it("cannot buy more than hardCap", async () => {
                    await fundingToken.connect(root).transfer(buyer2.address, hundredTwoETH);
                    await fundingToken.connect(buyer2).approve(seed.address, hundredTwoETH);
                    await seed.connect(admin).whitelist(buyer2.address);
                    await seed.connect(buyer2).buy(hundredTwoETH);
                    await expectRevert(seed.connect(buyer2).buy(twoHundredFourETH), "Seed: maximum funding reached");
                });
            });
        });
    });
});
