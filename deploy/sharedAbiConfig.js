const ownDeployedContracts = {
  Prime: {
    abi: "ERC20",
  },
};

// Add external contract addresses like DAI below
const externalContracts = {
  rinkeby: {},
  mainnet: {},
  kovan: {},
};

module.exports = {
  rinkeby: { ...ownDeployedContracts, ...externalContracts.rinkeby },
  mainnet: { ...ownDeployedContracts, ...externalContracts.mainnet },
  kovan: { ...ownDeployedContracts, ...externalContracts.kovan },
};
