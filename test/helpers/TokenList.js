// const {Token} = require('./Tokens');

class TokenList {
	constructor(tokens = []) {
	  this.tokens = tokens;
	}

	static async create(params, from) {
		params = typeof params === 'number' ? Array(params).fill({}) : params;
		if (!Array.isArray(params)) params = [params];

		params = params.map((param, i) => {
			if (typeof param === 'string') param = { symbol: param, from };
			const args = Object.assign({}, { symbol: `TK${i}`, name: `Token ${i}`, from }, param);
			if (typeof args === 'string') args = { symbol: args };
			
			let { name, symbol, decimals} = args;
			if (!name) name = 'Token';
			if (!symbol) symbol = 'TKN';
			if (!decimals) decimals = 18;
			return {
				from,
				name: name,
				symbol: symbol,
				decimals: decimals,
			};
			
		});
		console.log(params);
		const tokens = await Promise.all(params.map(super.deployToken));
		return new TokenList(tokens);
	}

	async deployToken(params) {
		const { symbol, name, decimals, from } = params;
		// const sender = from || (await ethers.getSigners())[0];
	
		const ERC20_Factory = await ethers.getContractFactory(
			"ERC20Mock",
			from
		);
		const instance = await ERC20_Factory.deploy(name, symbol);
	
		return new Token(name, symbol, decimals, instance);
	}

}

module.exports = {
	TokenList
}