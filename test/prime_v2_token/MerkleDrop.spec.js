const { deployments, network } = require("hardhat");
const { constants, BigNumber } = require("ethers");
const {
  mineBlocks,
  deploy,
  setupFixture,
  setupInitialState,
} = require("./utils/setupHelpers");
const { getTranche } = require("./merkle/math");

const MAX_BIG_INT = constants.MaxUint256;

const commonState = {
  initialPrimeV2Supply: BigNumber.from(10 ** 7),
  forwardBlocks: 100,
};

describe("MerkleDrop", () => {
  let merkleDropInstance, v2TokenInstance;

  describe("thresholdBlock lies in the past", () => {
    const initialState = { ...commonState, thresholdInPast: true };

    beforeEach("", async () => {
      ({ merkleDropInstance, v2TokenInstance } = await setupFixture({
        initialState,
      }));
    });

    it("bla", async () => {
      // console.log(await merkleDropInstance.token());
    });
  });

  // describe("initialization", () => {
  //   it("bla", async () => {
  //     console.log(merkleDropInstance);
  //     // console.log(await merkleDropInstance.token());
  //   });
  // });
});
