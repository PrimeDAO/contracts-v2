const { deployments, network } = require("hardhat");
const { constants, BigNumber, utils } = require("ethers");
const init = require("../../test-init.js");
const rawAllocations = require("./primeV2Distribution.json");
const { getTranche, createTreeWithAccounts } = require("../merkle");

const parsedAllocations = Object.fromEntries(
  Object.entries(rawAllocations).map(([address, allocation]) => {
    return [address, utils.parseEther(allocation)];
  })
);
const cumulativeAllocation = Object.entries(parsedAllocations).reduce(
  (accumulator, [_, allocation]) => {
    return accumulator.add(allocation);
  },
  BigNumber.from(0)
);

const mineBlocks = async (blockAmount) => {
  for (let i = 0; i < blockAmount; i++) {
    await network.provider.send("evm_mine");
  }
};

const deploy = async (initialState) => {
  const setup = await init.initialize(await ethers.getSigners());
  const merkleDropInstance = await init.merkleDrop(setup);
  const v2TokenInstance = await init.primeTokenV2({
    ...setup,
    ...initialState,
  });

  return { merkleDropInstance, v2TokenInstance };
};

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    await deployments.fixture();
    const { initialState } = options;
    const { merkleDropInstance, v2TokenInstance } = await deploy(initialState);

    // TODO: call setupInitialState
    await setupInitialState(merkleDropInstance, v2TokenInstance, initialState);

    return merkleDropInstance;
  }
);

const setupInitialState = async (
  merkleDropInstance,
  v2TokenInstance,
  initialState
) => {
  // go some blocks in the future

  const { forwardBlocks } = initialState;
  await mineBlocks(forwardBlocks);

  // get signers
  const [_, prime] = await ethers.getSigners();
  const currentBlock = await ethers.provider.getBlockNumber();

  // check if claiming date should be in the future
  const { thresholdInPast } = initialState;

  const thresholdBlockNumber = thresholdInPast
    ? currentBlock - 50
    : currentBlock + 50;

  // initialize MerkleDrop with Prime's address
  await merkleDropInstance
    .connect(prime)
    .initialize(
      prime.address,
      [prime.address],
      v2TokenInstance.address,
      BigNumber.from(thresholdBlockNumber)
    );

  // get cumulative allocation amount and approve
  await v2TokenInstance.approve(
    merkleDropInstance.address,
    cumulativeAllocation
  );

  // create tranche (tranch is a parsed group of claimable address/amount pairs)
  const tranche = getTranche(parsedAllocations);

  // create tree
  const tree = createTreeWithAccounts(tranche);
  console.log(tree);
  // pass merkle root and cumulativeAllocation to MerkleDrop (seedNewAllocation)
};

module.exports = { mineBlocks, deploy, setupFixture, setupInitialState };
