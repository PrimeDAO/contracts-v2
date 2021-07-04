const BN = require("bn.js");
const { simpleToExactAmount } = require("./math");
const { createTreeWithAccounts } = require("./merkleTree");

const parseToBnArr = (allocations) =>
  Object.entries(allocations).map(([address, allocation]) => {
    return [address, new BN(allocation.toString())];
  });

const getTranche = (...allocations) => {
  const parsedAllocations = parseToBnArr(allocations);

  return parsedAllocations.reduce(
    (prev, [account, balance, claimed]) => ({
      ...prev,
      [account]: { balance: simpleToExactAmount(balance), claimed },
    }),
    {}
  );
};

module.exports = { getTranche, createTreeWithAccounts };
