const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const BN = require("bn.js");
const { ethers } = require("hardhat");
const {
  getTranche,
  createTreeWithAccounts,
  getAccountBalanceProof,
} = require("../../tasks/utils/merkle");

const rawAllocations = [
  "1056.39331099660171709",
  "870.94684945018301126",
  "226.48095676324248635",
  "7.46007341986023537",
  "9.64320061541387227",
  "45.45852965164066046",
  "2.58531507323313161",
  "105.44076288303354762",
];

const matchAllocationsWithAddresses = (addresses, rawAllocations) =>
  Object.fromEntries(
    rawAllocations.map((allocation, index) => {
      return [addresses[index], utils.parseEther(allocation)];
    })
  );

const getCumulativeAllocation = (addresses, rawAllocations) => {
  const parsedAllocations = matchAllocationsWithAddresses(
    addresses,
    rawAllocations
  );

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
    await deployments.fixture(["Migration"]);
    const { deploy } = deployments;
    const { root } = await ethers.getNamedSigners();
    await deploy("TestToken", {
      contract: "ERC20Mock",
      from: root.address,
      args: ["TTOKEN", "TToken"],
      log: true,
    });
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
  const addresses = signers.map((signer) => signer.address);
  const { merkleDropInstance, v2TokenInstance } = contractInstances;

  const {
    withProof,
    trancheExpired,
    forwardBlocks,
    zeroAllocation,
    incorrectProof,
  } = initialState;

  let parsedAllocations = matchAllocationsWithAddresses(
    addresses,
    rawAllocations
  );
  let cumulativeAllocation = getCumulativeAllocation(addresses, rawAllocations);

  // go some blocks in the future
  await mineBlocks(forwardBlocks);
  const currentBlock = await ethers.provider.getBlockNumber();
  // get signers

  // initialize MerkleDrop with Prime's address
  await merkleDropInstance
    .connect(prime)
    .initialize(
      root.address,
      [prime.address, root.address],
      v2TokenInstance.address
    );

  // get cumulative allocation amount and approve
  await v2TokenInstance
    .connect(root)
    .approve(merkleDropInstance.address, cumulativeAllocation);

  // create tranche (tranch is a parsed group of claimable address/amount pairs)
  const tranche = getTranche(
    ...rawAllocations.map((balance, index) => [addresses[index], balance])
  );

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
    const modifiedAllocations = [...rawAllocations, "0"];
    const modifiedAddresses = [...addresses];
    modifiedAddresses[modifiedAllocations.length - 1] = alice.address;
    const modifiedTranche = getTranche(
      ...modifiedAllocations.map((balance, index) => [
        modifiedAddresses[index],
        balance,
      ])
    );
    tree = createTreeWithAccounts(modifiedTranche);
    ({ proof, expectedBalance } = generateProof(
      tree,
      alice.address,
      new BN(0),
      modifiedAddresses
    ));
    merkleRoot = tree.hexRoot;
    cumulativeAllocation = getCumulativeAllocation(
      modifiedAddresses,
      modifiedAllocations
    );
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
    : matchAllocationsWithAddresses(addresses, rawAllocations)[address],
});

const commonState = {
  initialPrimeV2Supply: utils.parseEther("100000000"),
  forwardBlocks: 100,
};

describe(">> MerkleDrop", () => {
  let merkleDropInstance, v2TokenInstance, contractInstances, alice, bob;

  before(async () => {
    const signers = await ethers.getSigners();
    alice = signers[2];
    bob = signers[3];
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({ merkleDropInstance, v2TokenInstance } = contractInstances);
  });

  describe("# claimTranche", () => {
    describe("$ allocation claims", () => {
      let proof, trancheIdx, expectedBalance;
      const initialState = {
        ...commonState,
        withProof: true,
      };

      beforeEach(async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
        await merkleDropInstance
          .connect(alice)
          .claimTranche(alice.address, trancheIdx, expectedBalance, proof);
      });

      it("lets alice claim her allocation", async () => {
        const aliceBalance = await v2TokenInstance.balanceOf(alice.address);
        expect(aliceBalance).to.eq(expectedBalance);
      });

      it("reverts if alice claims a second time", async () => {
        const duplicateClaim = merkleDropInstance.claimTranche(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        expect(duplicateClaim).to.be.revertedWith("LP has already claimed");
      });
    });

    describe("$ allocation is zero", () => {
      let proof, trancheIdx, expectedBalance;

      const initialState = {
        ...commonState,
        withProof: true,
        zeroAllocation: true,
      };

      it("reverts", async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
        const zeroClaim = merkleDropInstance.claimTranche(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        await expect(zeroClaim).to.be.revertedWith(
          "No balance would be transferred - not going to waste your gas"
        );
      });
    });
  });

  describe("# verifyClaim", () => {
    describe("$ claim is valid", () => {
      let proof, trancheIdx, expectedBalance;

      const initialState = {
        ...commonState,
        withProof: true,
      };

      beforeEach(async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
      });

      it("returns true", async () => {
        const verifiedBeforeExpiration = await merkleDropInstance.verifyClaim(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        expect(verifiedBeforeExpiration).to.eq(true);
      });
    });

    describe("$ tranche is expired", () => {
      let proof, trancheIdx, expectedBalance;

      const initialState = {
        ...commonState,
        withProof: true,
        trancheExpired: true,
      };

      beforeEach(async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
      });

      it("returns false", async () => {
        const verifiedAfterExpiration = await merkleDropInstance.verifyClaim(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        expect(verifiedAfterExpiration).to.eq(false);
      });
    });

    describe("$ merkle proof is incorrect", () => {
      let proof, trancheIdx, expectedBalance;

      const initialState = {
        ...commonState,
        withProof: true,
        incorrectProof: true,
      };

      it("reverts", async () => {
        ({ proof, trancheIdx, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));

        const claimWithIncorrectProof = merkleDropInstance
          .connect(alice)
          .claimTranche(alice.address, trancheIdx, expectedBalance, proof);

        await expect(claimWithIncorrectProof).to.be.revertedWith(
          "Incorrect merkle proof"
        );
      });
    });
  });
});
