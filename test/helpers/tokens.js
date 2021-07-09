
const ERC20TokenList = async (params, from, tokenFactory) => {
	/** 
	 * Function returns list with deployed token.
	 * 
	 * @param {list|number} params list with token symbols || number of tokens you want to create
	 * @param {signer} from signer of contract 
	 *
	*/

	// Create list from token symbols. If params is an integer, an empty list is created.
	params = typeof params === 'number' ? Array(params).fill({}) : params;
	if (!Array.isArray(params)) params = [params];

	// Formates an objects with keys for symbol and name from the list created above.
	params = params.map((param, i) => {

		if (typeof param === 'string') param = { symbol: param };
		const args = Object.assign({}, { symbol: `TK${i}`, name: `Token ${i}`}, param);
		if (typeof args === 'string') args = { symbol: args };
		
		let { name, symbol, decimals} = args;
		if (!name) name = 'Token';
		if (!symbol) symbol = 'TKN';
		if (!decimals) decimals = 18;
		return {
			name: name,
			symbol: symbol,
			decimals: decimals,
		};
	});

	// Create factory and tokens from params
	const ERC20_Factory = await ethers.getContractFactory(
		"ERC20Mock",
		from
	);
	let tokenList = await Promise.all(params.map(async (param) => {
		return await ERC20_Factory.deploy(param.name, param.symbol);
	}));

	return tokenList;
}

module.exports = {
	ERC20TokenList
}