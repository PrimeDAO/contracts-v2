const getNetwork = async () => {
  const {chainId} = await ethers.provider.getNetwork();
  switch(chainId){
      case 1: return "mainnet";
      case 4: return "rinkeby";
      default: return chainId;
  }
}

module.exports = {getNetwork}