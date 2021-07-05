const BN = require("bn.js");
const { simpleToExactAmount } = require("./math");
const {
  createTreeWithAccounts,
  getAccountBalanceProof,
} = require("./merkleTree");

const parseToBnArr = (allocations) =>
  Object.entries(allocations).map(([address, allocation]) => {
    return [address, new BN(allocation.toString())];
  });

const getTranche = (...allocations) => {
  return allocations.reduce(
    (prev, [account, balance, claimed]) => ({
      ...prev,
      [account]: { balance: simpleToExactAmount(balance), claimed },
    }),
    {}
  );
};

module.exports = {
  getTranche,
  createTreeWithAccounts,
  getAccountBalanceProof,
  parseToBnArr,
};
