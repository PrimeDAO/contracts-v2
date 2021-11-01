const ownDeployedContracts = {
  PrimeToken: {
    abi: "ERC20",
  },
};

const externalContracts = {
  rinkeby: {
    DAI: {
      address: "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa",
      abi: "ERC20",
    },
    WETH: {
      address: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
      abi: "ERC20",
    },
  },
  mainnet: {
    DAI: {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      abi: "ERC20",
    },
    WETH: {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      abi: "ERC20",
    },
  },
  kovan: {
    DAI: {
      address: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
      abi: "ERC20",
    },
    WETH: {
      address: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
      abi: "ERC20",
    },
  },
};

module.exports = {
  rinkeby: { ...ownDeployedContracts, ...externalContracts.rinkeby },
  mainnet: { ...ownDeployedContracts, ...externalContracts.mainnet },
  kovan: { ...ownDeployedContracts, ...externalContracts.kovan },
};
