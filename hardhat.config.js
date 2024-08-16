require("@nomicfoundation/hardhat-toolbox");
require("./tasks");
require("dotenv").config();

const COMPILER_SETTINGS = {
    optimizer: {
        enabled: true,
        runs: 1000000,
    },
    metadata: {
        bytecodeHash: "none",
    },
};

const MAINNET_RPC_URL =
    process.env.MAINNET_RPC_URL ||
    process.env.ALCHEMY_MAINNET_RPC_URL ||
    "https://eth-mainnet.alchemyapi.io/v2/your-api-key";

const POLYGON_MAINNET_RPC_URL =
    process.env.POLYGON_MAINNET_RPC_URL || "https://polygon-mainnet.alchemyapi.io/v2/your-api-key";

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;

const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "https://polygon-amoy.infura.io/v3/your-api-key";

const BSC_RPC_URL = process.env.BSC_RPC_URL || "";

const BSCTEST_RPC_URL = process.env.BSCTEST_RPC_URL || "";

const PRIVATE_KEY = process.env.PRIVATE_KEY;

// optional
// const MNEMONIC = process.env.MNEMONIC || "Your mnemonic";
const FORKING_BLOCK_NUMBER = parseInt(process.env.FORKING_BLOCK_NUMBER) || 0;

// Your API key for Etherscan, obtain one at https://etherscan.io/
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "Your etherscan API key";

const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "Your polygonscan API key";

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "Your bscscan key";

const ENABLE_REPORT_GAS = process.env.ENABLE_REPORT_GAS || false;

const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "Your coinmarketcap api key";

const GAS_REPORT_BASE_TOKEN = process.env.GAS_REPORT_BASE_TOKEN || "ETH";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.19",
                settings: COMPILER_SETTINGS,
            },
            {
                version: "0.8.7",
                settings: COMPILER_SETTINGS,
            },
            {
                version: "0.8.6",
                settings: COMPILER_SETTINGS,
            },
            {
                version: "0.8.0",
                settings: COMPILER_SETTINGS,
            },
        ],
    },
    networks: {
        hardhat: {
            hardfork: "merge",
            forking: {
                url: MAINNET_RPC_URL,
                blockNumber: FORKING_BLOCK_NUMBER,
                enabled: false, // Forking set true
            },
            chainId: 31337,
        },
        localhost: {
            chainId: 31337,
        },
        sepolia: {
            url: SEPOLIA_RPC_URL !== undefined ? SEPOLIA_RPC_URL : "",
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            //   accounts: {
            //     mnemonic: MNEMONIC,
            //   },
            chainId: 11155111,
        },
        mainnet: {
            url: MAINNET_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            chainId: 1,
        },
        polygon: {
            url: POLYGON_MAINNET_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            chainId: 137,
        },
        amoy: {
            url: AMOY_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            chainId: 80002,
        },
        bsc: {
            url: BSC_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            chainId: 56,
        },
        bsctest: {
            url: BSCTEST_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            chainId: 97,
        },
    },
    defaultNetwork: "hardhat",
    etherscan: {
        // yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
        apiKey: {
            // npx hardhat verify --list-networks
            sepolia: ETHERSCAN_API_KEY,
            mainnet: ETHERSCAN_API_KEY,
            polygon: POLYGONSCAN_API_KEY,
            polygonMumbai: POLYGONSCAN_API_KEY,
            bsc: BSCSCAN_API_KEY,
            bsctest: BSCSCAN_API_KEY,
        },
    },
    gasReporter: {
        enabled: ENABLE_REPORT_GAS,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        coinmarketcap: COINMARKETCAP_API_KEY,
        token: GAS_REPORT_BASE_TOKEN, // Change native token
    },
    contractSizer: {
        runOnCompile: false,
        only: ["RandomNumberConsumer", "Weather", "WitnessWeather"],
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./build/cache",
        artifacts: "./build/artifacts",
    },
    mocha: {
        timeout: 300000, // 300 seconds max for running tests
    },
};
