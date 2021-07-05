const { deployments, network } = require("hardhat");
const BN = require("bn.js");
const { BigNumber, utils } = require("ethers");
const init = require("../../test-init.js");
const rawAllocations = require("./primeV2Distribution.json");
const {
  getTranche,
  createTreeWithAccounts,
  getAccountBalanceProof,
} = require("../merkle");

const getParsedAllocations = (rawAllocations) =>
  Object.fromEntries(
    Object.entries(rawAllocations).map(([address, allocation]) => {
      return [address, utils.parseEther(allocation)];
    })
  );

const getCumulativeAllocation = (rawAllocations) => {
  const parsedAllocations = getParsedAllocations(rawAllocations);

  return Object.entries(parsedAllocations).reduce(
    (accumulator, [_, allocation]) => {
      return accumulator.add(allocation);
    },
    BigNumber.from(0)
  );
};

const mineBlocks = async (blockAmount) => {
  for (let i = 0; i < blockAmount; i++) {
    await network.provider.send("evm_mine");
  }
};

const deploy = async () => {
  const setup = await init.initialize(await ethers.getSigners());
  const merkleDropInstance = await init.merkleDrop(setup);
  const { seedToken: v2TokenInstance } = await init.tokens(setup);
  return { merkleDropInstance, v2TokenInstance };
};

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    await deployments.fixture();
    const { initialState } = options;
    const contractInstances = await deploy();

    const stateInfo = await setupInitialState(contractInstances, initialState);

    return { ...contractInstances, ...stateInfo };
  }
);

const setupInitialState = async (contractInstances, initialState) => {
  const trancheIdx = "0";
  const { merkleDropInstance, v2TokenInstance } = contractInstances;
  const {
    thresholdInPast,
    withProof,
    trancheExpired,
    forwardBlocks,
    zeroAllocation,
    incorrectProof,
  } = initialState;

  let parsedAllocations = getParsedAllocations(rawAllocations);
  let cumulativeAllocation = getCumulativeAllocation(rawAllocations);

  // go some blocks in the future
  await mineBlocks(forwardBlocks);

  // get signers
  const [root, prime, alice, bob] = await ethers.getSigners();
  const currentBlock = await ethers.provider.getBlockNumber();

  // check if claiming date should be in the future
  const thresholdBlockNumber = thresholdInPast
    ? currentBlock - 50
    : currentBlock + 50;

  // initialize MerkleDrop with Prime's address
  await merkleDropInstance
    .connect(prime)
    .initialize(
      root.address,
      [prime.address, root.address],
      v2TokenInstance.address,
      BigNumber.from(thresholdBlockNumber)
    );

  // get cumulative allocation amount and approve
  await v2TokenInstance
    .connect(root)
    .approve(merkleDropInstance.address, cumulativeAllocation);

  // create tranche (tranch is a parsed group of claimable address/amount pairs)
  const tranche = getTranche(...Object.entries(rawAllocations));

  // create tree
  let tree = createTreeWithAccounts(tranche);
  let merkleRoot = tree.hexRoot;

  // create proof if required for test
  let { proof, expectedBalance } =
    withProof &&
    generateProof(
      tree,
      alice.address,
      new BN(parsedAllocations[alice.address].toString())
    );

  // change allocation to zero if required for test
  if (zeroAllocation) {
    const modifiedAllocations = { ...rawAllocations, [alice.address]: "0" };
    const modifiedTranche = getTranche(...Object.entries(modifiedAllocations));
    tree = createTreeWithAccounts(modifiedTranche);
    ({ proof, expectedBalance } = generateProof(
      tree,
      alice.address,
      new BN(0)
    ));
    merkleRoot = tree.hexRoot;
    cumulativeAllocation = getCumulativeAllocation(modifiedAllocations);
  }

  if (incorrectProof) {
    ({ proof } = generateProof(
      tree,
      bob.address,
      new BN(parsedAllocations[bob.address].toString())
    ));
  }

  // pass merkle root and cumulativeAllocation to MerkleDrop (seedNewAllocation)
  await merkleDropInstance
    .connect(root)
    .seedNewAllocations(merkleRoot, cumulativeAllocation);

  // expire tranche if required for test
  trancheExpired &&
    (await merkleDropInstance.connect(prime).expireTranche(trancheIdx));

  return { tree, proof, trancheIdx, expectedBalance };
};

const generateProof = (tree, address, balance) => ({
  proof: getAccountBalanceProof(tree, address, balance),
  expectedBalance: balance.isZero()
    ? BigNumber.from(0)
    : getParsedAllocations(rawAllocations)[address],
});

module.exports = {
  mineBlocks,
  deploy,
  setupFixture,
  setupInitialState,
};
