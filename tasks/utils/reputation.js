const { utils } = require("ethers");
const initialRepBalances = require("../../inputs/initialRepBalances.json");

const { parseEther } = utils;

const getReputationParams = () => {
  let repHolders = [];
  let repAmounts = [];
  Object.entries(initialRepBalances).forEach(([address, amount]) => {
    repHolders.push(address);
    repAmounts.push(parseEther(amount.toString()));
  });

  return { repHolders, repAmounts };
};

module.exports = { getReputationParams };
