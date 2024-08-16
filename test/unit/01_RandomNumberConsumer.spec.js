const { network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { networkConfig, developmentChains } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Random Number Consumer Unit Tests", async function () {
          // We define a fixture to reuse the same setup in every test.
          // We use loadFixture to run this setup once, snapshot that state,
          // and reset Hardhat Network to that snapshot in every test.
          async function deployRandomNumberConsumerFixture() {
              const [deployer] = await ethers.getSigners();

              /**
               * @dev Read more at https://docs.chain.link/docs/chainlink-vrf/
               */
              const BASE_FEE = "1000000000000000"; // 0.001 ether as base fee
              const GAS_PRICE = "50000000000"; // 50 gwei
              const WEI_PER_UNIT_LINK = "10000000000000000"; // 0.01 ether per LINK

              const chainId = network.config.chainId;

              const VRFCoordinatorMockFactory = await ethers.getContractFactory(
                  "VRFCoordinatorV2_5Mock"
              );
              const VRFCoordinatorMock = await VRFCoordinatorMockFactory.deploy(
                  BASE_FEE,
                  GAS_PRICE,
                  WEI_PER_UNIT_LINK
              );

              const fundAmount = networkConfig[chainId]["fundAmount"] || "1000000000000000000";
              const transaction = await VRFCoordinatorMock.createSubscription();
              const transactionReceipt = await transaction.wait(1);
              const subscriptionId = ethers.BigNumber.from(transactionReceipt.events[0].topics[1]);
              await VRFCoordinatorMock.fundSubscription(subscriptionId, fundAmount);

              const vrfCoordinatorAddress = VRFCoordinatorMock.address;
              const keyHash =
                  networkConfig[chainId]["keyHash"] ||
                  "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";

              const randomNumberConsumerFactory = await ethers.getContractFactory(
                  "RandomNumberConsumer"
              );
              const randomNumberConsumer = await randomNumberConsumerFactory
                  .connect(deployer)
                  .deploy(subscriptionId, vrfCoordinatorAddress, keyHash);

              await VRFCoordinatorMock.addConsumer(subscriptionId, randomNumberConsumer.address);

              return { randomNumberConsumer, VRFCoordinatorMock };
          }

          describe("#requestRandomWords", async function () {
              describe("success", async function () {
                  it("Should successfully request a random number", async function () {
                      const { randomNumberConsumer, VRFCoordinatorMock } = await loadFixture(
                          deployRandomNumberConsumerFixture
                      );
                      await expect(randomNumberConsumer.requestRandomWords()).to.emit(
                          VRFCoordinatorMock,
                          "RandomWordsRequested"
                      );
                  });

                  it("Should successfully request a random number and get a result", async function () {
                      const { randomNumberConsumer, VRFCoordinatorMock } = await loadFixture(
                          deployRandomNumberConsumerFixture
                      );
                      await randomNumberConsumer.requestRandomWords();
                      const requestId = await randomNumberConsumer.getRequestId();

                      // simulate callback from the oracle network
                      await expect(
                          VRFCoordinatorMock.fulfillRandomWords(
                              requestId,
                              randomNumberConsumer.address
                          )
                      ).to.emit(randomNumberConsumer, "ReturnedRandomness");

                      const randomNumber = await randomNumberConsumer.getRandomWord();
                      assert(
                          randomNumber.gt(ethers.constants.Zero),
                          "Random number is greater than zero"
                      );
                  });

                  it("Should successfully fire event on callback", async function () {
                      const { randomNumberConsumer, VRFCoordinatorMock } = await loadFixture(
                          deployRandomNumberConsumerFixture
                      );

                      await new Promise(async (resolve, reject) => {
                          randomNumberConsumer.once("ReturnedRandomness", async () => {
                              console.log("ReturnedRandomness event fired!");
                              const randomNumber = await randomNumberConsumer.getRandomWord();

                              // assert throws an error if it fails, so we need to wrap
                              // it in a try/catch so that the promise returns event
                              // if it fails.
                              try {
                                  assert(randomNumber.gt(ethers.constants.Zero));
                                  resolve();
                              } catch (e) {
                                  reject(e);
                              }
                          });
                          await randomNumberConsumer.requestRandomWords();
                          const requestId = await randomNumberConsumer.getRequestId();
                          VRFCoordinatorMock.fulfillRandomWords(
                              requestId,
                              randomNumberConsumer.address
                          );
                      });
                  });
              });
          });
      });
