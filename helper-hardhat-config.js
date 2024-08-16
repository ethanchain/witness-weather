const networkConfig = {
    default: {
        name: "hardhat",
        fee: "100000000000000000",
        keyHash: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        fundAmount: "1000000000000000000",
        witnessUsdLowerLimit: 0,
        witnessUsdUpperLimit: 0,
        ethAddress: "0xd66c6B4F0be8CE5b39D52E0Fd1344c389929B378",
        timestampOffset: -18000,
        nativeLimitFee: "50000000000000000",
        ethLimitFee: "10000000000000000",
    },
    31337: {
        name: "localhost",
        fee: "100000000000000000",
        keyHash: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        fundAmount: "1000000000000000000",
        ethUsdPriceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
        witnessUsdLowerLimit: 0,
        witnessUsdUpperLimit: 0,
        ethAddress: "0xd66c6B4F0be8CE5b39D52E0Fd1344c389929B378",
        timestampOffset: -18000,
        nativeLimitFee: "50000000000000000",
        ethLimitFee: "10000000000000000",
    },
    1: {
        name: "mainnet",
        linkToken: "0x514910771af9ca656af840dff83e8264ecf986ca",
        fundAmount: "0",
    },
    56: {
        name: "bsc",
        linkToken: "0x404460C6A5EdE2D891e8297795264fDe62ADBB75",
        subscriptionId: "Your subscriptionId",
        vrfCoordinator: "0xd691f04bc0C9a24Edb78af9E005Cf85768F694C9",
        ethUsdPriceFeed: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e",
        nativeUsdPriceFeed: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
        keyHash: "Key hash",
    },
    97: {
        name: "bsctest",
        linkToken: "0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06",
        subscriptionId:
            "47313971506407865941884679279363414996530900355741123370257496185460659001665",
        vrfCoordinator: "0xDA3b641D438362C440Ac5458c57e00a712b66700",
        ethUsdPriceFeed: "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",
        nativeUsdPriceFeed: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",
        keyHash: "0x8596b430971ac45bdf6088665b9ad8e8630c9d5049ab54b14dff711bee7c0e26", // 50 gwei
        witnessUsdLowerLimit: 0,
        witnessUsdUpperLimit: 0,
        ethAddress: "0xd66c6B4F0be8CE5b39D52E0Fd1344c389929B378",
        timestampOffset: -18000,
        nativeLimitFee: "50000000000000000",
        ethLimitFee: "10000000000000000",
    },
};

const developmentChains = ["hardhat", "localhost"];
const VERIFICATION_BLOCK_CONFIRMATIONS = 6;

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
};
