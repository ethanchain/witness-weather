const { ethers, network } = require("hardhat");
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../../helper-hardhat-config");

async function deployWitnessWeather(chainId, weatherAddress) {
    let ethPriceFeedaddress;
    let nativePriceFeedAddress;
    let VRFCoordinatorV2Mock;
    let subscriptionId;
    let vrfCoordinatorAddress;

    if (developmentChains.includes(network.name)) {
        console.log("Mock Aggregator...");
        const DECIMALS = "18";
        const INITIAL_PRICE = "200000000000000000000";

        const ethMockV3AggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");
        const ethMockV3Aggregator = await ethMockV3AggregatorFactory.deploy(
            DECIMALS,
            INITIAL_PRICE
        );
        ethPriceFeedaddress = ethMockV3Aggregator.address;

        const nativeMockV3AggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");
        const nativeMockV3Aggregator = await nativeMockV3AggregatorFactory.deploy(
            DECIMALS,
            INITIAL_PRICE
        );
        nativePriceFeedAddress = nativeMockV3Aggregator.address;
        console.log("Mock VRF...");
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
        console.log(`Weather subscriptionId: ${subscriptionId}`);
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, fundAmount);
    } else {
        ethPriceFeedaddress = networkConfig[chainId]["ethUsdPriceFeed"];
        nativePriceFeedAddress = networkConfig[chainId]["nativeUsdPriceFeed"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
        vrfCoordinatorAddress = networkConfig[chainId]["vrfCoordinator"];
    }
    console.log(
        `WitnessWeather ethPriceFeedaddress: ${ethPriceFeedaddress}, nativePriceFeedAddress: ${nativePriceFeedAddress}`
    );

    const witnessUsdLowerLimit = networkConfig[chainId]["witnessUsdLowerLimit"];
    const witnessUsdUpperLimit = networkConfig[chainId]["witnessUsdUpperLimit"];

    const ethAddress = networkConfig[chainId]["ethAddress"];
    const timestampOffset = networkConfig[chainId]["timestampOffset"];
    const nativeLimitFee = networkConfig[chainId]["nativeLimitFee"];
    const ethLimitFee = networkConfig[chainId]["ethLimitFee"];

    const witnessWeatherFactory = await ethers.getContractFactory("WitnessWeather");
    console.log(`WitnessWeather weatherAddress: ${weatherAddress}, ethLimitFee: ${ethLimitFee}`);
    const keyHash = networkConfig[chainId]["keyHash"];
    const witnessWeather = await witnessWeatherFactory.deploy(
        subscriptionId,
        vrfCoordinatorAddress,
        keyHash,
        weatherAddress,
        witnessUsdLowerLimit,
        witnessUsdUpperLimit,
        ethPriceFeedaddress,
        nativePriceFeedAddress,
        ethAddress,
        timestampOffset,
        nativeLimitFee,
        ethLimitFee
    );
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;
    await witnessWeather.deployTransaction.wait(waitBlockConfirmations);

    console.log(`WitnessWeather deployed to ${witnessWeather.address} on ${network.name}`);
}

module.exports = {
    deployWitnessWeather,
};
