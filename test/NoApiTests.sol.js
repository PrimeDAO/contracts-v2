const { expect } = require("chai");

let gnosisSafe,gnosisSafeProxyFactory, seedFactory, roles, signature;

beforeEach(async () => {
    const accounts = await ethers.getSigners();
    roles = {
        deployer: accounts[0],
        randomPerson: accounts[1],
    };
    const gnosisSafeFactory = await ethers.getContractFactory(
        "GnosisSafe",
        roles.deployer
    );
    gnosisSafe = await gnosisSafeFactory.deploy();

    const gnosisSafeProxyFactoryFactory = await ethers.getContractFactory(
        "GnosisSafeProxyFactory",
        roles.deployer
    );
    gnosisSafeProxyFactory = await  gnosisSafeProxyFactoryFactory.deploy();

    const seedFactoryFactory = await ethers.getContractFactory(
        "SeedFactory",
        roles.deployer
    );
    seedFactory = await  seedFactoryFactory.deploy();


});

describe("Gnosis tests", function () {
    context("Try to setup gnosis", function () {
        it("Sets GnosisSafe up", async function () {
            const proxy_tx = await gnosisSafeProxyFactory
                    .connect(roles.deployer)
                    .createProxy(gnosisSafe.address, "0x00");
            const proxy_receit = await proxy_tx.wait();
            const proxy_addr = proxy_receit.events.filter((x) => {return x.event === "ProxyCreation"})[0].args['proxy'];
            const proxy = await ethers.getContractAt(
                "GnosisSafe",
                proxy_addr
            );

            const signatureFactory = await ethers.getContractFactory(
                "SigatureHandler",
                roles.deployer
            );
            signature = await  signatureFactory.deploy(proxy_addr);


            await seedFactory.transferOwnership(proxy.address);
            await proxy
                    .connect(roles.deployer)
                    .setup(
                        [roles.deployer.address],
                        1,
                        proxy.address,
                        "0x",
                        roles.deployer.address,
                        roles.deployer.address,
                        0,
                        roles.deployer.address);

            const hash = await proxy
                .connect(roles.deployer)
                .encodeTransactionData(
                    seedFactory.address,
                    100,
                    "0x00",
                    1,
                    10000000,
                    10000000,
                    10000000,
                    roles.deployer.address,
                    roles.deployer.address,
                    1
                );

            console.log(hash);
            console.log(signature.address);
            const signed_hash_tx = await signature.connect(roles.deployer).signMessage(hash);
            const signed_hash_receipt = await signed_hash_tx.wait();
            const signed_hash = signed_hash_receipt.events.filter((x) => {return x.event === "SignMsg"})[0].args['msgHash'];
            console.log(signed_hash);
            const signatures = await signature.getSignatures(signed_hash);
            console.log(signatures);

            // await proxy.checkSignatures(
            //     signed_hash,
            //     hash,
            //     signatures
            //     )

            await proxy.execTransaction(
                seedFactory.address,
                100,
                "0x00",
                1,
                10000000,
                10000000,
                10000000,
                roles.deployer.address,
                roles.deployer.address,
                signatures[0])
        });
    });
});
