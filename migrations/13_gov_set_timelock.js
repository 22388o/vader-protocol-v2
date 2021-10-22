const GovernorAlpha = artifacts.require("GovernorAlpha");
const Timelock = artifacts.require("Timelock");

module.exports = async function (deployer, network, accounts) {
    const gov = await GovernorAlpha.deployed();
    const timelock = await Timelock.deployed();

    const tx = await gov.setTimelock(timelock.address);

    console.log(tx);
};
