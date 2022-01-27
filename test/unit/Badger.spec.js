const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

const setupTest = deployments.createFixture(async ({ deployments, ethers }) => {
  await deployments.fixture("Badger");
  return await ethers.getContract("Badger");
});

describe("Badger", function () {
  // base config
  const defaultUriId = "QmTPHQWYMPrwsRuuhmehpbFtWYFNWLcWGmio9KxPk7fKfk";

  const amount = 2;

  const nonTransferableTier = {
    tokenId: 2,
    uriIdentifier: defaultUriId,
    isTransferable: false,
  };

  const transferableTier = {
    tokenId: 3,
    uriIdentifier: defaultUriId,
    isTransferable: true,
  };

  let badgerInstance, owner, alice, bob, baseUri;

  before("get signers", async () => {
    [owner, alice, bob] = await ethers.getSigners();
  });

  beforeEach(async () => {
    badgerInstance = await setupTest();
    baseUri = await badgerInstance.uri(0);
  });

  /*
    minting and burning
  */

  describe("#mint", () => {
    it("mints the correct token amount to the recipient", async function () {
      const { tokenId, uriIdentifier, isTransferable } = nonTransferableTier;
      await badgerInstance.createTokenTier(
        tokenId,
        uriIdentifier,
        isTransferable
      );
      await badgerInstance.mint(alice.address, tokenId, amount);

      const tokenAmount = await badgerInstance.balanceOf(
        alice.address,
        tokenId
      );

      expect(tokenAmount).to.equal(amount);
    });

    context("when token tier does not exist", () => {
      it("reverts 'Tier does not exist", async function () {
        await expect(
          badgerInstance.mint(alice.address, 1, amount)
        ).to.be.revertedWith("Tier does not exist");
      });
    });

    context("when called by non-contract-owner", () => {
      it("reverts 'Ownable: caller is not the owner", async function () {
        await expect(
          badgerInstance.connect(alice).mint(alice.address, 1, amount)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#burn", () => {
    context("when token tier does not exist", () => {
      it("reverts 'Tier does not exist'", async function () {
        await expect(
          badgerInstance.burn(alice.address, 1, amount)
        ).to.be.revertedWith("Tier does not exist");
      });
    });

    context("when called by non-contract-owner", () => {
      it("reverts 'Ownable: caller is not the owner'", async function () {
        await expect(
          badgerInstance.connect(alice).burn(alice.address, 1, amount)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    context("with existing token tier", () => {
      const { tokenId, uriIdentifier, isTransferable } = nonTransferableTier;

      beforeEach("create token tier & mint", async () => {
        await badgerInstance.createTokenTier(
          tokenId,
          uriIdentifier,
          isTransferable
        );
        await badgerInstance.mint(alice.address, tokenId, amount);
      });

      it("burns one token from alice", async () => {
        const burnAmount = 1;
        await badgerInstance.burn(alice.address, tokenId, burnAmount);
        expect(await badgerInstance.balanceOf(alice.address, tokenId)).to.equal(
          amount - burnAmount
        );
      });

      it("burns two tokens from alice", async () => {
        const burnAmount = 2;
        await badgerInstance.burn(alice.address, tokenId, burnAmount);
        expect(await badgerInstance.balanceOf(alice.address, tokenId)).to.equal(
          amount - burnAmount
        );
      });
    });
  });

  describe("#mintToMultiple", () => {
    const amounts = [10, 20];
    const tokenIds = [nonTransferableTier.tokenId, transferableTier.tokenId];

    let addresses;

    beforeEach("create TWO token tiers", async () => {
      addresses = [alice.address, bob.address];

      await badgerInstance.createTokenTier(
        nonTransferableTier.tokenId,
        nonTransferableTier.uriIdentifier,
        nonTransferableTier.isTransferable
      );

      await badgerInstance.createTokenTier(
        transferableTier.tokenId,
        transferableTier.uriIdentifier,
        transferableTier.isTransferable
      );
    });

    context("valid inputs and access rights", () => {
      beforeEach("mint a batch of token to diff addresses", async () => {
        await badgerInstance.mintToMultiple(addresses, tokenIds, amounts);
      });

      it("mints correct amount of tokens to alice", async () => {
        const aliceBalance = await badgerInstance.balanceOf(
          alice.address,
          nonTransferableTier.tokenId
        );
        expect(aliceBalance).to.equal(amounts[0]);
      });

      it("mints correct amount of tokens to bob", async () => {
        const bobBalance = await badgerInstance.balanceOf(
          bob.address,
          transferableTier.tokenId
        );
        expect(bobBalance).to.equal(amounts[1]);
      });
    });

    context("with invalid input arrays", () => {
      const tooManyAmounts = [...amounts, 420];

      it("reverts 'Input array mismatch'", async () => {
        expect(
          badgerInstance.mintToMultiple(addresses, tokenIds, tooManyAmounts)
        ).to.be.revertedWith("Input array mismatch");
      });
    });

    context("when called by non-contract-owner", () => {
      it("reverts 'Input array mismatch'", async () => {
        expect(
          badgerInstance
            .connect(alice)
            .mintToMultiple(addresses, tokenIds, amounts)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    context("when one token tier does not exist", () => {
      const nonExistentTokenId = 66;

      it("reverts 'Tier does not exist'", async () => {
        expect(
          badgerInstance.mintToMultiple(
            addresses,
            [nonTransferableTier.tokenId, nonExistentTokenId],
            amounts
          )
        ).to.be.revertedWith("Tier does not exist");
      });
    });
  });

  describe("#burnFromMultiple", () => {
    const burnAmounts = [2, 4];
    const amounts = [10, 20];
    const tokenIds = [nonTransferableTier.tokenId, transferableTier.tokenId];

    let addresses;

    beforeEach("create TWO token tiers", async () => {
      addresses = [alice.address, bob.address];
      await badgerInstance.createTokenTier(
        nonTransferableTier.tokenId,
        nonTransferableTier.uriIdentifier,
        nonTransferableTier.isTransferable
      );

      await badgerInstance.createTokenTier(
        transferableTier.tokenId,
        transferableTier.uriIdentifier,
        transferableTier.isTransferable
      );
    });

    context("with valid inputs and access rights", () => {
      beforeEach("mint a batch of token to diff addresses", async () => {
        await badgerInstance.mintToMultiple(addresses, tokenIds, amounts);
      });

      beforeEach("burn tokens", async () => {
        await badgerInstance.burnFromMultiple(addresses, tokenIds, burnAmounts);
      });

      it("burns correct amount of tokens from alice", async () => {
        const aliceBalance = await badgerInstance.balanceOf(
          alice.address,
          nonTransferableTier.tokenId
        );
        expect(aliceBalance).to.equal(amounts[0] - burnAmounts[0]);
      });

      it("burns correct amount of tokens from bob", async () => {
        const bobBalance = await badgerInstance.balanceOf(
          bob.address,
          transferableTier.tokenId
        );
        expect(bobBalance).to.equal(amounts[1] - burnAmounts[1]);
      });
    });

    context("with invalid inputs", () => {
      it("reverts 'Input array mismatch'", async () => {
        expect(
          badgerInstance.burnFromMultiple(
            addresses,
            tokenIds,
            burnAmounts.slice(0, burnAmounts.length - 1)
          )
        ).to.be.revertedWith("Input array mismatch");
      });
    });

    context("when called by non-contract-owner", () => {
      it("reverts 'Ownable: caller is not the owner'", async () => {
        expect(
          badgerInstance
            .connect(alice)
            .burnFromMultiple(addresses, tokenIds, burnAmounts)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  /*
    creating/editing token tier
  */

  describe("#createTokenTier", () => {
    const { tokenId, uriIdentifier, isTransferable } = nonTransferableTier;

    it("sets uriId for specified token ID", async () => {
      await badgerInstance.createTokenTier(
        tokenId,
        uriIdentifier,
        isTransferable
      );

      const { uriId, transferable } = await badgerInstance.tokenTiers(tokenId);
      expect(uriId).to.equal(uriIdentifier);
      expect(transferable).to.equal(isTransferable);
    });

    it("emits an event 'TierChange'", async () => {
      await expect(
        badgerInstance.createTokenTier(tokenId, uriIdentifier, isTransferable)
      )
        .to.emit(badgerInstance, "TierChange")
        .withArgs(tokenId, uriIdentifier, isTransferable);
    });

    context("when called by non-contract-owner", () => {
      it("reverts 'Ownable: caller is not the owner'", () => {
        expect(
          badgerInstance
            .connect(alice)
            .createTokenTier(tokenId, uriIdentifier, isTransferable)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    context("without uriIdentifier", () => {
      const emptyUriIdentifier = "";

      it("reverts 'Ownable: caller is not the owner'", () => {
        expect(
          badgerInstance.createTokenTier(
            tokenId,
            emptyUriIdentifier,
            isTransferable
          )
        ).to.be.revertedWith("String cannot be empty");
      });
    });

    context("when tier already exists", () => {
      beforeEach("create token tier", async () => {
        await badgerInstance.createTokenTier(
          tokenId,
          uriIdentifier,
          isTransferable
        );
      });

      it("reverts 'Tier already exists for tokenId'", () => {
        expect(
          badgerInstance.createTokenTier(tokenId, uriIdentifier, isTransferable)
        ).to.be.revertedWith("Tier already exists for tokenId");
      });
    });
  });

  describe("#batchCreateTokenTiers", () => {
    beforeEach("batch create tiers", async () => {
      await badgerInstance.batchCreateTokenTiers(
        [nonTransferableTier.tokenId, transferableTier.tokenId],
        [nonTransferableTier.uriIdentifier, transferableTier.uriIdentifier],
        [nonTransferableTier.isTransferable, transferableTier.isTransferable]
      );
    });

    it("creates correct nontransferable token", async () => {
      const nontransferableToken = await badgerInstance.tokenTiers(
        nonTransferableTier.tokenId
      );
      expect(nontransferableToken.uriId).to.equal(
        nonTransferableTier.uriIdentifier
      );
      expect(nontransferableToken.transferable).to.equal(
        nonTransferableTier.isTransferable
      );
    });

    it("creates correct transferable token", async () => {
      const transferableToken = await badgerInstance.tokenTiers(
        transferableTier.tokenId
      );
      expect(transferableToken.uriId).to.equal(transferableTier.uriIdentifier);
      expect(transferableToken.transferable).to.equal(
        transferableTier.isTransferable
      );
    });

    context("with differing input array lengths", () => {
      it("reverts 'Input array mismatch'", async () => {
        await expect(
          badgerInstance.batchCreateTokenTiers(
            [nonTransferableTier.tokenId, transferableTier.tokenId],
            [nonTransferableTier.uriIdentifier, transferableTier.uriIdentifier],
            [nonTransferableTier.isTransferable]
          )
        ).to.be.revertedWith("Input array mismatch");
      });
    });
  });

  describe("#updateUriIdentifier", () => {
    const { tokenId, uriIdentifier, isTransferable } = nonTransferableTier;
    const newUriId = "420";

    beforeEach("create new token tier", async () => {
      await badgerInstance.createTokenTier(
        tokenId,
        uriIdentifier,
        isTransferable
      );
    });

    it("saves the new uriId and returns correct uri", async () => {
      await badgerInstance.updateUriIdentifier(tokenId, newUriId);

      const uri = await badgerInstance.uri(tokenId);

      expect(uri).to.equal(baseUri + newUriId);
    });

    it("emits an event 'TierChange'", async () => {
      await expect(badgerInstance.updateUriIdentifier(tokenId, newUriId))
        .to.emit(badgerInstance, "TierChange")
        .withArgs(tokenId, newUriId, isTransferable);
    });

    context("when called by non-contract-owner", () => {
      it("reverts 'Ownable: caller is not the owner'", () => {
        expect(
          badgerInstance.connect(alice).updateUriIdentifier(tokenId, newUriId)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    context("when uriId is empty string ", () => {
      const empytUriId = "";

      it("reverts 'String cannot be empty'", () => {
        expect(
          badgerInstance.updateUriIdentifier(tokenId, empytUriId)
        ).to.be.revertedWith("String cannot be empty");
      });
    });

    context("when token tier does not exist", () => {
      it("reverts 'Tier does not exist'", () => {
        expect(
          badgerInstance.updateUriIdentifier(66, newUriId)
        ).to.be.revertedWith("Tier does not exist");
      });
    });
  });

  describe("#updateMultipleUriIdentifiers", () => {
    const newUriIds = ["first_id", "second_id"];

    beforeEach("create two token tiers", async () => {
      await badgerInstance.createTokenTier(
        nonTransferableTier.tokenId,
        nonTransferableTier.uriIdentifier,
        nonTransferableTier.isTransferable
      );
      await badgerInstance.createTokenTier(
        transferableTier.tokenId,
        transferableTier.uriIdentifier,
        transferableTier.isTransferable
      );
    });

    beforeEach("update tokens' uriIds", async () => {
      await badgerInstance.updateMultipleUriIdentifiers(
        [nonTransferableTier.tokenId, transferableTier.tokenId],
        newUriIds
      );
    });

    it("saves the correct uri for the first token tier", async () => {
      const uri = await badgerInstance.uri(nonTransferableTier.tokenId);

      expect(uri).to.equal(baseUri + newUriIds[0]);
    });

    it("saves the correct uri for the second token tier", async () => {
      const uri = await badgerInstance.uri(transferableTier.tokenId);

      expect(uri).to.equal(baseUri + newUriIds[1]);
    });

    context("when one uriId is an empty string", () => {
      it("reverts 'String cannot be empty'", () => {
        expect(
          badgerInstance.updateMultipleUriIdentifiers(
            [nonTransferableTier.tokenId, transferableTier.tokenId],
            ["first_id", ""]
          )
        ).to.be.revertedWith("String cannot be empty");
      });
    });

    context("when called by non-contract-owner", () => {
      it("reverts 'Ownable: caller is not the owner'", () => {
        expect(
          badgerInstance
            .connect(alice)
            .updateMultipleUriIdentifiers(
              [nonTransferableTier.tokenId, transferableTier.tokenId],
              newUriIds
            )
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("#updateTransferableStatus", () => {
    const { tokenId, uriIdentifier, isTransferable } = nonTransferableTier;
    const newTransferability = true;

    beforeEach("create new token tier", async () => {
      await badgerInstance.createTokenTier(
        tokenId,
        uriIdentifier,
        isTransferable
      );
    });

    it("saves the new uriId and returns correct uri", async () => {
      await badgerInstance.updateTransferableStatus(
        tokenId,
        newTransferability
      );

      const { transferable } = await badgerInstance.tokenTiers(tokenId);

      expect(transferable).to.equal(newTransferability);
    });

    it("emits an event 'TierChange'", async () => {
      await expect(
        badgerInstance.updateTransferableStatus(tokenId, newTransferability)
      )
        .to.emit(badgerInstance, "TierChange")
        .withArgs(tokenId, uriIdentifier, newTransferability);
    });

    context("when called by non-contract-owner", () => {
      it("reverts 'Ownable: caller is not the owner'", () => {
        expect(
          badgerInstance
            .connect(alice)
            .updateTransferableStatus(tokenId, newTransferability)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    context("when token tier does not exist", () => {
      const nonExistentTokenId = 66;

      it("reverts 'Tier does not exist'", () => {
        expect(
          badgerInstance.updateTransferableStatus(
            nonExistentTokenId,
            newTransferability
          )
        ).to.be.revertedWith("Tier does not exist");
      });
    });
  });

  describe("#changeBaseUri", () => {
    const newBaseUri = "www.example.com/";

    it("changes the baseUri", async () => {
      await badgerInstance.changeBaseUri(newBaseUri);

      const receivedNewUri = await badgerInstance.uri(0);

      expect(receivedNewUri).to.be.equal(newBaseUri);
    });

    context("with empty string", () => {
      const emptyString = "";

      it("reverts 'String cannot be empty'", async () => {
        expect(badgerInstance.changeBaseUri(emptyString)).to.be.revertedWith(
          "String cannot be empty"
        );
      });
    });

    context("when called by non-contract-owner", () => {
      it("reverts 'Ownable: caller is not the owner'", async () => {
        expect(
          badgerInstance.connect(alice).changeBaseUri(newBaseUri)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  /*
    Transferring tokens
  */

  describe("#safeTransferFrom", () => {
    context("with non-transferable token", () => {
      const { tokenId, uriIdentifier, isTransferable } = nonTransferableTier;

      beforeEach("create token tier & mint", async () => {
        await badgerInstance.createTokenTier(
          tokenId,
          uriIdentifier,
          isTransferable
        );
        await badgerInstance.mint(alice.address, tokenId, amount);
      });

      context("when called by owner of the token", () => {
        it("reverts 'Transfer disabled for this tokenId'", () => {
          expect(
            badgerInstance
              .connect(alice)
              .safeTransferFrom(
                alice.address,
                bob.address,
                nonTransferableTier.tokenId,
                amount,
                0
              )
          ).to.be.revertedWith("Transfer disabled for this tier");
        });
      });

      context("when called by owner of the contract", () => {
        it("reverts 'Transfer disabled for this tokenId'", () => {
          expect(
            badgerInstance.safeTransferFrom(
              alice.address,
              bob.address,
              nonTransferableTier.tokenId,
              amount,
              0
            )
          ).to.be.revertedWith("Transfer disabled for this tier");
        });
      });
    });

    context("with transferable token", () => {
      const { tokenId, uriIdentifier, isTransferable } = transferableTier;

      beforeEach("create token tier & mint", async () => {
        await badgerInstance.createTokenTier(
          tokenId,
          uriIdentifier,
          isTransferable
        );
        await badgerInstance.mint(alice.address, tokenId, amount);
      });

      context("when called by owner of the token", () => {
        it("transfers the tokens to the beneficiary", async () => {
          await badgerInstance
            .connect(alice)
            .safeTransferFrom(alice.address, bob.address, tokenId, amount, 0);

          const balance = await badgerInstance.balanceOf(bob.address, tokenId);

          expect(balance).to.equal(amount);
        });
      });

      context("when called by owner of contract", () => {
        it("transfers the token to the beneficiary", async () => {
          await badgerInstance.safeTransferFrom(
            alice.address,
            bob.address,
            tokenId,
            amount,
            0
          );

          const balance = await badgerInstance.balanceOf(bob.address, tokenId);

          expect(balance).to.equal(amount);
        });
      });

      context("when called by random dude", () => {
        it("reverts 'Unauthorized'", async () => {
          expect(
            badgerInstance
              .connect(bob)
              .safeTransferFrom(alice.address, bob.address, tokenId, amount, 0)
          ).to.be.revertedWith("Unauthorized");
        });
      });
    });
  });

  describe("#safeBatchTransferFrom", () => {
    context("with non-transferable token", () => {
      const { tokenId, uriIdentifier, isTransferable } = nonTransferableTier;

      beforeEach("create token tier & mint", async () => {
        await badgerInstance.createTokenTier(
          tokenId,
          uriIdentifier,
          isTransferable
        );
        await badgerInstance.mint(alice.address, tokenId, amount);
      });

      context("when called by owner of the token", () => {
        it("reverts 'Transfer disabled for this tier'", async () => {
          await expect(
            badgerInstance
              .connect(alice)
              .safeBatchTransferFrom(
                alice.address,
                bob.address,
                [nonTransferableTier.tokenId, transferableTier.tokenId],
                [amount, amount],
                0
              )
          ).to.be.revertedWith("Transfer disabled for this tier");
        });
      });
    });

    context("with transferable token", () => {
      const { tokenId, uriIdentifier, isTransferable } = transferableTier;

      beforeEach("create token tier & mint", async () => {
        await badgerInstance.createTokenTier(
          tokenId,
          uriIdentifier,
          isTransferable
        );
        await badgerInstance.mint(alice.address, tokenId, amount);
      });

      context("when called by owner of the token", () => {
        it("transfers the token to the recipient", async () => {
          await badgerInstance
            .connect(alice)
            .safeBatchTransferFrom(
              alice.address,
              bob.address,
              [transferableTier.tokenId],
              [amount],
              0
            );

          expect(
            await badgerInstance.balanceOf(
              bob.address,
              transferableTier.tokenId
            )
          ).to.equal(amount);
        });
      });
    });
  });

  describe("#transferFromWithoutData", () => {
    beforeEach("create token tier & mint", async () => {
      await badgerInstance.createTokenTier(
        transferableTier.tokenId,
        transferableTier.uriIdentifier,
        transferableTier.isTransferable
      );
      await badgerInstance.createTokenTier(
        nonTransferableTier.tokenId,
        nonTransferableTier.uriIdentifier,
        nonTransferableTier.isTransferable
      );

      await badgerInstance.mint(
        alice.address,
        transferableTier.tokenId,
        amount
      );
      await badgerInstance.mint(
        alice.address,
        nonTransferableTier.tokenId,
        amount
      );
    });

    context("when token tier is non-transferable", () => {
      context("when caller is contract owner", () => {
        it("reverts 'Transfer disabled for this tier'", async () => {
          await expect(
            badgerInstance.transferFromWithoutData(
              alice.address,
              bob.address,
              nonTransferableTier.tokenId,
              amount
            )
          ).to.be.revertedWith("Transfer disabled for this tier");
        });
      });

      context("when caller is token owner", () => {
        it("reverts 'Transfer disabled for this tier'", async () => {
          await expect(
            badgerInstance
              .connect(alice)
              .transferFromWithoutData(
                alice.address,
                bob.address,
                nonTransferableTier.tokenId,
                amount
              )
          ).to.be.revertedWith("Transfer disabled for this tier");
        });
      });
    });

    context("when token tier is transferable", () => {
      context("when caller is contract owner", () => {
        it("transfers token to bob", async () => {
          await badgerInstance.transferFromWithoutData(
            alice.address,
            bob.address,
            transferableTier.tokenId,
            amount
          );

          const balance = await badgerInstance.balanceOf(
            bob.address,
            transferableTier.tokenId
          );

          expect(balance).to.equal(amount);
        });
      });

      context("when caller is token owner", () => {
        it("transfers token to bob", async () => {
          await badgerInstance
            .connect(alice)
            .transferFromWithoutData(
              alice.address,
              bob.address,
              transferableTier.tokenId,
              amount
            );

          const balance = await badgerInstance.balanceOf(
            bob.address,
            transferableTier.tokenId
          );

          expect(balance).to.equal(amount);
        });
      });

      context("when caller is random dude", () => {
        it("reverts 'Unauthorized'", async () => {
          await expect(
            badgerInstance
              .connect(bob)
              .transferFromWithoutData(
                alice.address,
                bob.address,
                transferableTier.tokenId,
                amount
              )
          ).to.be.revertedWith("Unauthorized");
        });
      });

      context("when caller is approved", () => {
        it("transfers token to bob", async () => {
          await badgerInstance
            .connect(alice)
            .setApprovalForAll(bob.address, true);
          await badgerInstance
            .connect(bob)
            .transferFromWithoutData(
              alice.address,
              bob.address,
              transferableTier.tokenId,
              amount
            );
          const balance = await badgerInstance.balanceOf(
            bob.address,
            transferableTier.tokenId
          );

          expect(balance).to.equal(amount);
        });
      });
    });
  });

  /*
    Querying token URI
  */

  describe("#uri", () => {
    beforeEach("create token tier & mint", async () => {
      await badgerInstance.createTokenTier(
        nonTransferableTier.tokenId,
        nonTransferableTier.uriIdentifier,
        nonTransferableTier.isTransferable
      );
      await badgerInstance.mint(
        alice.address,
        nonTransferableTier.tokenId,
        amount
      );
    });

    it("returns the baseUri appended by tokenUri", async () => {
      const uri = await badgerInstance.uri(nonTransferableTier.tokenId);

      expect(uri).to.equal(`${baseUri}${nonTransferableTier.uriIdentifier}`);
    });
  });
});
