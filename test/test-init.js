const { parseEther } = ethers.utils;

const PROXY_CREATION = "ProxyCreation";
const PRIME_CAP = parseEther("90000000").toString();
const PRIME_SUPPLY = parseEther("21000000").toString();

const initialize = async (accounts) => {
  const setup = {};
  setup.roles = {
    root: accounts[0],
    prime: accounts[1],
    beneficiary: accounts[2],
    buyer1: accounts[3],
    buyer2: accounts[4],
    buyer3: accounts[5],
    buyer4: accounts[6],
  };

  return setup;
};

const getGnosisProxyInstance = async (setup) => {
  const gnosisSafeProxyFactoryFactory = await ethers.getContractFactory(
    "GnosisSafeProxyFactory",
    setup.roles.prime
  );
  const gnosisSafeProxyFactoryInstance =
    await gnosisSafeProxyFactoryFactory.deploy();

  const proxy_tx = await gnosisSafeProxyFactoryInstance
    .connect(setup.roles.prime)
    .createProxy(setup.gnosisSafe.address, "0x00");
  const proxy_receit = await proxy_tx.wait();
  const proxy_addr = proxy_receit.events.filter((data) => {
    return data.event === PROXY_CREATION;
  })[0].args["proxy"];
  return await ethers.getContractAt("GnosisSafe", proxy_addr);
};

const getLBPWrapperFactory = async (setup) => {
  return await ethers.getContractFactory("LBPWrapper", setup.roles.root);
};

const getContractInstance = async (factoryName, address, args) => {
  const Factory = await ethers.getContractFactory(factoryName, address);
  return await Factory.deploy(args ? args : []);
};

const gettokenInstances = async (setup) => {
  const PrimeToken_Factory = await ethers.getContractFactory(
    "PrimeToken",
    setup.roles.root
  );
  const seedToken = await PrimeToken_Factory.deploy(
    PRIME_SUPPLY,
    PRIME_CAP,
    setup.roles.root.address
  );

  const ERC20_Factory = await ethers.getContractFactory(
    "ERC20Mock",
    setup.roles.root
  );
  const fundingToken = await ERC20_Factory.deploy("DAI Stablecoin", "DAI");

  return { seedToken, fundingToken };
};

module.exports = {
  initialize,
  getGnosisProxyInstance,
  gettokenInstances,
  getLBPWrapperFactory,
  getContractInstance,
};
