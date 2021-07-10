// adds Signer contract as a delegate for Gnosis Safe

require('dotenv').config({path:'./.env'});
const DeployedContracts = require('../contractAddresses.json');
const { api } = require('./utils/gnosis.js');
const {getNetwork} = require('./utils/helpers.js');

const main = async () => {
    const network = await getNetwork();
    const account = (await ethers.getSigners())[0];

    const safe = DeployedContracts[network].Safe;
    const delegate = DeployedContracts[network].Signer;
    const gnosis = api(safe);
    const label = "Signer";
    const totp = Math.floor(Math.floor(Date.now()/1000) / 3600);
    const signature = await account.signMessage(delegate+totp.toString());
    const payload = {
        safe,
        delegate,
        label,
        signature
    };
    const result = await gnosis.addDelegate(payload);
    if(result.status == 201){
        console.log("Successfully added");
        return;
    }
    console.log(result);
    return;
}

main();