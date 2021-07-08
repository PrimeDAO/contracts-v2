const { modules } = require("web3");

class VaultFactory {

	static async deployVault(setup) {
		const mocked = false;
		const pauseWindowDuration = 0;
		const bufferPeriodDuration = 0;
		const from = setup.roles.root;
		
		//The Authorizer artifact can't be found. I thought I added it with
		// https://github.com/balancer-labs/balancer-v2-monorepo/tree/master/pkg/vault
		const Authorizer_Factory = await ethers.getContractFactory(
			'Authorizer',
			setup.roles.root
		);

		authorizer = await authorizer_Factory.deploy(setup.roles.prime);

		const ERC20_Factory = await ethers.getContractFactory(
			"ERC20Mock",
			setup.roles.root
		);
		const weth = await ERC20_Factory.deploy('Wrapped ETH', 'WEI');

		const Valut_Factory = await ethers.getContractFactory(
			'Vault',
			setup.roles.root
		);
		const args = [authorizer.address, weth.address, pauseWindowDuration, bufferPeriodDuration];
		vault = await authorizer_Factory.deploy(...args);

		return vault;
	}

};

module.exports = {
	VaultFactory

};
