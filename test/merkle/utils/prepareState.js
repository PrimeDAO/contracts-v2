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

const getParsedAllocations = (addresses, rawAllocations) =>
  Object.fromEntries(
    rawAllocations.map((allocation, index) => {
      return [addresses[index], utils.parseEther(allocation)];
    })
  );

const getCumulativeAllocation = (addresses, rawAllocations) => {
  const parsedAllocations = getParsedAllocations(addresses, rawAllocations);

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

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    await deployments.fixture();

    const contractInstances = {
      merkleDropInstance: await ethers.getContract("MerkleDrop"),
      v2TokenInstance: await ethers.getContract("TestToken"),
    };

    return { ...contractInstances };
  }
);

const setupInitialState = async (contractInstances, initialState) => {
  const trancheIdx = "0";

  const signers = await ethers.getSigners();
  const [root, prime, alice, bob] = signers;
  const addresses = signers.map(signer=>signer.address);
  const { merkleDropInstance, v2TokenInstance } = contractInstances;

  const {
    thresholdInPast,
    withProof,
    trancheExpired,
    forwardBlocks,
    zeroAllocation,
    incorrectProof,
  } = initialState;

  let parsedAllocations = getParsedAllocations(addresses, rawAllocations);
  let cumulativeAllocation = getCumulativeAllocation(addresses, rawAllocations);

  // go some blocks in the future
  await mineBlocks(forwardBlocks);
  const currentBlock = await ethers.provider.getBlockNumber();
  // get signers

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
  const tranche = getTranche(...rawAllocations.map((balance, index)=>[addresses[index],balance]));

  // create tree
  let tree = createTreeWithAccounts(tranche);
  let merkleRoot = tree.hexRoot;

  // create proof if required for test
  let { proof, expectedBalance } =
    withProof &&
    generateProof(
      tree,
      alice.address,
      new BN(parsedAllocations[alice.address].toString()),
      addresses
    );

  // change allocation to zero if required for test
  if (zeroAllocation) {
    const modifiedAllocations = [ ...rawAllocations, "0" ];
    const modifiedAddresses = [...addresses];
    modifiedAddresses[modifiedAllocations.length-1] = alice.address;
    const modifiedTranche = getTranche(...modifiedAllocations.map((balance, index)=>[modifiedAddresses[index],balance]));
    tree = createTreeWithAccounts(modifiedTranche);
    ({ proof, expectedBalance } = generateProof(
      tree,
      alice.address,
      new BN(0),
      modifiedAddresses
    ));
    merkleRoot = tree.hexRoot;
    cumulativeAllocation = getCumulativeAllocation(modifiedAddresses, modifiedAllocations);
  }

  if (incorrectProof) {
    ({ proof } = generateProof(
      tree,
      bob.address,
      new BN(parsedAllocations[bob.address].toString()),
      addresses
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

const generateProof = (tree, address, balance, addresses) => ({
  proof: getAccountBalanceProof(tree, address, balance),
  expectedBalance: balance.isZero()
    ? BigNumber.from(0)
    : getParsedAllocations(addresses, rawAllocations)[address],
});

module.exports = {
  mineBlocks,
  setupFixture,
  setupInitialState,
};
