const ownDeployedContracts = {
  PrimeToken: {
    abi: "IERC20",
  },
};

const externalContracts = {
  rinkeby: {
    DAI: {
      address: "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa",
      abi: "IERC20",
    },
    WETH: {
      address: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
      abi: "IERC20",
    },
  },
  mainnet: {
    DAI: {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      abi: "IERC20",
    },
    WETH: {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      abi: "IERC20",
    },
  },
};

module.exports = {
  rinkeby: { ...ownDeployedContracts, ...externalContracts.rinkeby },
  mainnet: { ...ownDeployedContracts, ...externalContracts.mainnet },
};
