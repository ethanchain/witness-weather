const { ethers, network, run } = require("hardhat");
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../../helper-hardhat-config");

async function deployRandomNumberConsumer(chainId) {
    let VRFCoordinatorV2Mock;
    let subscriptionId;
    let vrfCoordinatorAddress;

    if (chainId == 31337) {
        const BASE_FEE = "100000000000000000";
        const GAS_PRICE_LINK = "1000000000"; // 0.000000001 LINK per gas
        const WEI_PER_UNIT_LINK = "3000000000000000"; // 0.003
        const VRFCoordinatorV2MockFactory = await ethers.getContractFactory(
            "VRFCoordinatorV2_5Mock"
        );
        VRFCoordinatorV2Mock = await VRFCoordinatorV2MockFactory.deploy(
            BASE_FEE,
            GAS_PRICE_LINK,
            WEI_PER_UNIT_LINK
        );
        vrfCoordinatorAddress = VRFCoordinatorV2Mock.address;

        const fundAmount = networkConfig[chainId]["fundAmount"] || "1000000000000000000";
        const transaction = await VRFCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transaction.wait(1);
        subscriptionId = ethers.BigNumber.from(transactionReceipt.events[0].topics[1]);
        console.log(`RandomNumberConsumer subscriptionId: ${subscriptionId}`);
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, fundAmount);
    } else {
        subscriptionId = networkConfig[chainId]["subscriptionId"];
        vrfCoordinatorAddress = networkConfig[chainId]["vrfCoordinator"];
    }

    const keyHash = networkConfig[chainId]["keyHash"];
    console.log(`RandomNumberConsumer keyHash: ${keyHash}`);

    const randomNumberConsumerFactory = await ethers.getContractFactory("RandomNumberConsumer");
    const randomNumberConsumer = await randomNumberConsumerFactory.deploy(
        subscriptionId,
        vrfCoordinatorAddress,
        keyHash
    );

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;
    await randomNumberConsumer.deployTransaction.wait(waitBlockConfirmations);

    console.log(
        `Random Number Consumer deployed to ${randomNumberConsumer.address} on ${network.name}`
    );

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await run("verify:verify", {
            address: randomNumberConsumer.address,
            constructorArguments: [subscriptionId, vrfCoordinatorAddress, keyHash],
        });
    }

    if (chainId == 31337) {
        VRFCoordinatorV2Mock.addConsumer(subscriptionId, randomNumberConsumer.address);
    }
}

module.exports = {
    deployRandomNumberConsumer,
};
