const { network, ethers } = require("hardhat");
const { networkConfig, developmentChains } = require("../../helper-hardhat-config");
const { assert } = require("chai");
const VRF_COORDINATOR_ABI = require("@chainlink/contracts/abi/v0.8/VRFCoordinatorV2_5.json");
const LINK_TOKEN_ABI = require("@chainlink/contracts/abi/v0.8/LinkToken.json");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Random Number Consumer Staging Tests", async function () {
          let randomNumberConsumer;

          before(async function () {
              const [deployer] = await ethers.getSigners();

              const chainId = network.config.chainId;

              let subscriptionId = networkConfig[chainId]["subscriptionId"];

              const vrfCoordinatorAddress = networkConfig[chainId]["vrfCoordinator"];
              const keyHash = networkConfig[chainId]["keyHash"];

              const vrfCoordinator = new ethers.Contract(
                  vrfCoordinatorAddress,
                  VRF_COORDINATOR_ABI,
                  deployer
              );

              if (!subscriptionId) {
                  const transaction = await vrfCoordinator.createSubscription();
                  console.log("subscriptionId is not set, creating a new subscription.....");

                  const transactionReceipt = await transaction.wait(1);
                  subscriptionId = ethers.BigNumber.from(transactionReceipt.events[0].topics[1]);
                  console.log(
                      `subscription created successfully, and subscription Id is ${subscriptionId}`
                  );
              }

              const fundAmount = networkConfig[chainId]["fundAmount"];
              const linkTokenAddress = networkConfig[chainId]["linkToken"];
              const linkToken = new ethers.Contract(linkTokenAddress, LINK_TOKEN_ABI, deployer);
              console.log(`Transfer ${fundAmount} LINK to subscription ${subscriptionId}..... `);

              await linkToken.transferAndCall(
                  vrfCoordinatorAddress,
                  fundAmount,
                  ethers.utils.defaultAbiCoder.encode(["uint256"], [subscriptionId])
              );

              const randomNumberConsumerFactory = await ethers.getContractFactory(
                  "RandomNumberConsumer"
              );
              console.log("Deploying the VRF consumer smart contract......");

              randomNumberConsumer = await randomNumberConsumerFactory
                  .connect(deployer)
                  .deploy(subscriptionId, vrfCoordinatorAddress, keyHash);
              console.log(`VRF consumer deployed successfully at ${randomNumberConsumer.address}`);

              console.log(`Adding consumer ${randomNumberConsumer.address} to coordinator`);
              await vrfCoordinator.addConsumer(subscriptionId, randomNumberConsumer.address);
          });

          it("Our event should successfully fire event on callback", async function () {
              // we setup a promise so we can wait for our callback from the `once` function
              await new Promise(async (resolve, reject) => {
                  // setup listener for our event
                  randomNumberConsumer.once("ReturnedRandomness", async () => {
                      console.log("ReturnedRandomness event fired!");
                      const randomNumber = await randomNumberConsumer.getRandomWord();
                      // assert throws an error if it fails, so we need to wrap
                      // it in a try/catch so that the promise returns event
                      // if it fails.
                      try {
                          assert(
                              randomNumber.gt(ethers.constants.Zero),
                              "Random number is greater than zero"
                          );
                          resolve();
                      } catch (e) {
                          reject(e);
                      }
                  });

                  try {
                      console.log("Requesting random words...");
                      await randomNumberConsumer.requestRandomWords();
                  } catch (error) {
                      reject(error);
                  }
              });
          });
      });
