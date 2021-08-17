const { utils, BigNumber } = require("ethers");

const { parseEther, formatEther } = utils;

const getReputationParams = (initialRepBalances) => {
  let repHolders = [];
  let repAmounts = [];
  Object.entries(initialRepBalances).forEach(([address, amount]) => {
    repHolders.push(address);
    repAmounts.push(BigNumber.from(amount));
  });

  return { repHolders, repAmounts };
};

module.exports = { getReputationParams };
