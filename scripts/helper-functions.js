const { run, network, ethers } = require("hardhat");
const { networkConfig } = require("../helper-hardhat-config");

const AUTO_FUND = process.env.AUTO_FUND || true;

const autoFundCheck = async (contractAddr, networkName, linkTokenAddress, additionalMessage) => {
    const chainId = network.config.chainId;
    console.log("Checking to see if contract can be auto-funded with LINK:");
    const amount = networkConfig[chainId]["fundAmount"];
    //check to see if user has enough LINK
    const accounts = await ethers.getSigners();
    const signer = accounts[0];
    const LinkToken = await ethers.getContractFactory("MockLinkToken");
    const linkTokenContract = new ethers.Contract(linkTokenAddress, LinkToken.interface, signer);
    const balanceBN = await linkTokenContract.balanceOf(signer.address);
    const balance = balanceBN.toString();
    const contractBalanceBN = await linkTokenContract.balanceOf(contractAddr);
    const contractBalance = await contractBalanceBN.toString();
    if (balance > amount && amount > 0 && contractBalance < amount) {
        //user has enough LINK to auto-fund
        //and the contract isn't already funded
        return true;
    } else {
        //user doesn't have enough LINK, print a warning
        console.log(
            "Account doesn't have enough LINK to fund contracts, you're deploying to a network where auto funding isn't done by default, the contract is already funded, or you set AUTO_FUND to false."
        );
        console.log(
            `Please obtain LINK via the faucet at https://faucets.chain.link/${networkName} then run the following command to fund contract with LINK:`
        );
        console.log(
            `yarn hardhat fund-link --contract ${contractAddr} --network ${networkName} ${additionalMessage}`
        );
        return false;
    }
};

const verify = async (contractAddress, args) => {
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(e);
        }
    }
};

const stripHexPrefix = (hex) => {
    if (!ethers.utils.isHexString(hex)) {
        throw Error(`Expected valid hex string, got: "${hex}"`);
    }

    return hex.replace("0x", "");
};

const addHexPrefix = (hex) => {
    return hex.startsWith("0x") ? hex : `0x${hex}`;
};

const numToBytes32 = (num) => {
    const hexNum = ethers.utils.hexlify(num);
    const strippedNum = stripHexPrefix(hexNum);
    if (strippedNum.length > 32 * 2) {
        throw Error(
            "Cannot convert number to bytes32 format, value is greater than maximum bytes32 value"
        );
    }
    return addHexPrefix(strippedNum.padStart(32 * 2, "0"));
};

const makeSureMoonMinutes = async (timestampOffSet) => {
    const latestBlock = await ethers.provider.getBlock("latest");
    const blockTimestamp = latestBlock.timestamp;
    // int256 correctTimestamp = int256(block.timestamp) + i_timestampOffset + plusDiff;
    // int256 _hours = (correctTimestamp / 60 / 60) % 24;
    // int256 _minutes = (correctTimestamp / 60) % 60;
    // // 12:00 ~ 12:10
    // return _hours == 12 && _minutes <= 10;

    const targetHours = 12;
    const targetMinutes = 1;
    // Calculate correctTimestamp reach target value
    const targetTimestamp = targetHours * 60 * 60 + targetMinutes * 60;
    // Caculate minusDiff, let correctTimestamp to reach target value
    const correctTimestamp = blockTimestamp + timestampOffSet;
    const modSeconds = correctTimestamp % (24 * 60 * 60);
    const plusDiff = targetTimestamp - modSeconds;
    let correctDiffTime;
    // Time zone correct
    if (plusDiff >= 0) {
        correctDiffTime = plusDiff;
    } else {
        correctDiffTime = 24 * 60 * 60 + plusDiff;
    }
    return correctDiffTime;
};

module.exports = {
    autoFundCheck,
    verify,
    numToBytes32,
    makeSureMoonMinutes,
};
