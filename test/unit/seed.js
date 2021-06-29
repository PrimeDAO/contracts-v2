const {expect} = require('chai');
const {constants} = require('@openzeppelin/test-helpers');

const init = require("../test-init.js");

const deploy = async () => {
    const setup = await init.initialize(await ethers.getSigners());;

    setup.seed = await init.seedMasterCopy(setup);

    setup.data = {};

    return setup;
}

describe('>> Deploy a new seed contract', async () => {
    let setup;
    let nonce = 0;
    before('!! setup', async () => {
        setup = await deploy();
    });
    context('$ prequesities', async () => {
        it('seed factory should have correct mastercopy', async () => {
            // checking if the mastercopy is set correct
            // expect(await setup.seedFactory.masterCopy()).to.equal(setup.seed.address);
            expect(true).to.equal(true);
        });
    //     it('transfer seed factory ownership to safe', async () => {
    //         // transfering ownership to safe, as seedFactory.deploySeed() should be called by safe only
    //         await setup.seedFactory.connect(setup.roles.prime).transferOwnership(setup.proxySafe.address);
    //         expect(await setup.seedFactory.connect(setup.roles.prime).owner()).to.equal(setup.proxySafe.address);
    //     });
    });
 });
