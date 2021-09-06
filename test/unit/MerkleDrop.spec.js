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

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    const { deploy } = deployments;
    const { root } = await ethers.getNamedSigners();

    await deploy("MerkleDrop", {
      from: root.address,
      args: [],
      log: true,
    });

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
    zeroAllocation,
    incorrectProof,
    withoutSeededAllocation,
  } = initialState;

  const parsedAllocations = matchAllocationsWithAddresses(
    addresses,
    rawAllocations
  );
  let cumulativeAllocation = getCumulativeAllocation(addresses, rawAllocations);

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

  let proof, expectedBalance;
  if (withProof) {
    ({ proof, expectedBalance } = generateProof(
      tree,
      alice.address,
      new BN(parsedAllocations[alice.address].toString()),
      addresses
    ));
  }

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
  !withoutSeededAllocation &&
    (await merkleDropInstance
      .connect(root)
      .seedNewAllocations(merkleRoot, cumulativeAllocation));

  // expire tranche if required for test
  trancheExpired &&
    (await merkleDropInstance.connect(prime).expireTranche(trancheIdx));

  return {
    tree,
    proof,
    trancheIdx,
    expectedBalance,
    merkleRoot,
  };
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
  let merkleDropInstance,
    v2TokenInstance,
    contractInstances,
    alice,
    bob,
    prime,
    root;

  before(async () => {
    const signers = await ethers.getSigners();
    [root, prime, alice, bob] = signers;
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({ merkleDropInstance, v2TokenInstance } = contractInstances);
  });

  describe("# claimTranche", () => {
    describe("$ with only one tranche", () => {
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

      it("lets alice claim her allocation", async () => {
        await merkleDropInstance
          .connect(alice)
          .claimTranche(alice.address, trancheIdx, expectedBalance, proof);

        const aliceBalance = await v2TokenInstance.balanceOf(alice.address);
        expect(aliceBalance).to.eq(expectedBalance);
      });

      it("reverts if alice claims a second time", async () => {
        await merkleDropInstance
          .connect(alice)
          .claimTranche(alice.address, trancheIdx, expectedBalance, proof);
        const duplicateClaim = merkleDropInstance.claimTranche(
          alice.address,
          trancheIdx,
          expectedBalance,
          proof
        );

        expect(duplicateClaim).to.be.revertedWith("LP has already claimed");
      });

      it("reverts if tranch is expired", async () => {
        await merkleDropInstance.connect(prime).expireTranche(trancheIdx);
        expect(
          merkleDropInstance
            .connect(alice)
            .claimTranche(alice.address, trancheIdx, expectedBalance, proof)
        ).to.be.revertedWith("Incorrect merkle proof");
      });
    });

    describe("$ with second tranche", async () => {
      let secondMerkleRoot,
        secondTree,
        aliceFirstProof,
        aliceFirstExpectedBalance;

      const firstTrancheIdx = "0";
      const secondTrancheIdx = "1";
      const aliceSecondClaim = "10";
      const bobSecondClaim = "20";
      const initialState = {
        ...commonState,
        withProof: true,
      };

      beforeEach("add a second tranche", async () => {
        ({
          proof: aliceFirstProof,
          expectedBalance: aliceFirstExpectedBalance,
        } = await setupInitialState(contractInstances, initialState));

        const secondAllocation = [
          [alice.address, aliceSecondClaim],
          [bob.address, bobSecondClaim],
        ];
        const secondCumulativeAllocation = utils
          .parseEther(aliceSecondClaim)
          .add(utils.parseEther(bobSecondClaim));
        const secondTranche = getTranche(...secondAllocation);

        secondTree = createTreeWithAccounts(secondTranche);
        secondMerkleRoot = secondTree.hexRoot;

        await v2TokenInstance
          .connect(root)
          .increaseAllowance(
            merkleDropInstance.address,
            secondCumulativeAllocation
          );
        await merkleDropInstance
          .connect(root)
          .seedNewAllocations(secondMerkleRoot, secondCumulativeAllocation);
      });

      it("lets alice claim her first and second claim", async () => {
        await merkleDropInstance
          .connect(alice)
          .claimTranche(
            alice.address,
            firstTrancheIdx,
            aliceFirstExpectedBalance,
            aliceFirstProof
          );
        const aliceSecondProof = getAccountBalanceProof(
          secondTree,
          alice.address,
          utils.parseEther(aliceSecondClaim)
        );
        await merkleDropInstance
          .connect(alice)
          .claimTranche(
            alice.address,
            secondTrancheIdx,
            utils.parseEther(aliceSecondClaim),
            aliceSecondProof
          );

        const expectedTotalBalance = utils
          .parseEther(aliceSecondClaim)
          .add(aliceFirstExpectedBalance);
        expect(await v2TokenInstance.balanceOf(alice.address)).to.eq(
          expectedTotalBalance
        );
      });

      describe("$ with first tranche expired", () => {
        it("still lets alice claim her second claim", async () => {
          await merkleDropInstance
            .connect(prime)
            .expireTranche(firstTrancheIdx);

          const aliceSecondProof = getAccountBalanceProof(
            secondTree,
            alice.address,
            utils.parseEther(aliceSecondClaim)
          );
          await merkleDropInstance
            .connect(alice)
            .claimTranche(
              alice.address,
              secondTrancheIdx,
              utils.parseEther(aliceSecondClaim),
              aliceSecondProof
            );

          expect(await v2TokenInstance.balanceOf(alice.address)).to.eq(
            utils.parseEther(aliceSecondClaim)
          );
        });
      });

      describe("$ with second tranche expired", () => {
        it("still lets alice claim her first claim", async () => {
          await merkleDropInstance
            .connect(prime)
            .expireTranche(secondTrancheIdx);
          await merkleDropInstance
            .connect(alice)
            .claimTranche(
              alice.address,
              firstTrancheIdx,
              aliceFirstExpectedBalance,
              aliceFirstProof
            );

          expect(await v2TokenInstance.balanceOf(alice.address)).to.eq(
            aliceFirstExpectedBalance
          );
        });
      });
    });

    describe("$ with allocation is zero", () => {
      let proof, trancheIdx, expectedBalance;

      const initialState = {
        ...commonState,
        withProof: true,
        zeroAllocation: true,
      };

      it("reverts 'No balance would be transferred - not going to waste your gas'", async () => {
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

    describe("with non-existent tranche", () => {
      let proof, expectedBalance;

      const initialState = {
        ...commonState,
        withProof: true,
        zeroAllocation: true,
      };
      const nonExistentTrancheIdx = "5";

      it("reverts 'Tranche does not yet exist'", async () => {
        ({ proof, expectedBalance } = await setupInitialState(
          contractInstances,
          initialState
        ));
        const nonexistentTrancheClaim = merkleDropInstance.claimTranche(
          alice.address,
          nonExistentTrancheIdx,
          expectedBalance,
          proof
        );

        await expect(nonexistentTrancheClaim).to.be.revertedWith(
          "Tranche does not yet exist"
        );
      });
    });
  });

  describe("# verifyClaim", () => {
    describe("$ with valid claim", () => {
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

    describe("$ with expired tranche", () => {
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

    describe("$ with incorrect merkle proof", () => {
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

  describe("# expireTranche", () => {
    let trancheIdx;

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

    it("sets merkle root of tranche to zero", async () => {
      await merkleDropInstance.connect(prime).expireTranche(trancheIdx);

      const expiredMerkleRoot = await merkleDropInstance.merkleRoots(
        trancheIdx
      );
      expect(expiredMerkleRoot).to.equal(BigNumber.from(0));
    });
  });
});
