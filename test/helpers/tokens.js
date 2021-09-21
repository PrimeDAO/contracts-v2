const getErc20TokenInstances = async (params, from) => {
  /**
   * Function returns list with deployed token.
   *
   * @param {list|number} params list with token symbols || number of tokens you want to create
   * @param {signer} from signer of contract
   *
   */

  // Create list from token symbols. If params is an integer, an empty list is created.
  params = Array(params).fill({});

  // Formates an objects with keys for symbol and name from the list created above.
  params = params.map((param, i) => {
    const args = Object.assign({ symbol: `TOK${i}`, name: `Token${i}` });

    let { name, symbol } = args;

    return {
      name: name,
      symbol: symbol,
    };
  });

  // Create factory and tokens from params
  const erc20Factory = await ethers.getContractFactory("ERC20Mock", from);
  let tokenList = await Promise.all(
    params.map(async (param) => {
      return await erc20Factory.deploy(param.name, param.symbol);
    })
  );

  if (tokenList.length == 2) {
    if (tokenList[0].address > tokenList[1].address) {
      tokenList.reverse();
    }
  }

  return tokenList;
};

module.exports = {
  getErc20TokenInstances,
};
