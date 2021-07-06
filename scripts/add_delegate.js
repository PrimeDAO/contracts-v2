require('dotenv').config({path:'./.env'});
const {SAFE} = require('../config.json');
const {['4']: {SIGNER: signer}} = require('../contract-addresses.json');
const { api } = require('./utils/gnosis_url_generator.js');
const {PROVIDER_KEY, MNEMONIC} = process.env;
const gnosis = api(SAFE);

const main = async () => {
    const rinkeby = new ethers.providers.InfuraProvider('rinkeby', PROVIDER_KEY);
    const wallet = await (new ethers.Wallet.fromMnemonic(MNEMONIC)).connect(rinkeby);

    const delegate = signer;
    const label = "Signer";
    const safe = SAFE;
    const totp = Math.floor(Math.floor(Date.now()/1000) / 3600);
    const signature = await wallet.signMessage(delegate+totp.toString());
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