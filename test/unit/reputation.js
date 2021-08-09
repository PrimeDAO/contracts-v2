const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  constants,
  time,
  expectRevert,
  BN,
} = require("@openzeppelin/test-helpers");
const { parseEther } = ethers.utils;

const init = require("../test-init.js");

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());

  setup.reputation = await init.reputation(setup);

  setup.data = {};

  return setup;
};

describe("SeedFactory", () => {
  let setup;
  let reputation;

  context("» creator is owner", () => {
    before("!! deploy setup", async () => {
      setup = await deploy();

      reputation = setup.reputation;
    });
    it("does a test", async () => {
      console.log("test");
    });
  });
})
