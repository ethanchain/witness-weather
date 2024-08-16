const { network, ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { networkConfig, developmentChains } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Weather Unit Tests", async function () {
          // We define a fixture to reuse the same setup in every test.
          async function deployWeatherFixture() {
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

              const weatherFactory = await ethers.getContractFactory("Weather");
              const weather = await weatherFactory
                  .connect(deployer)
                  .deploy(subscriptionId, vrfCoordinatorAddress, keyHash);

              await VRFCoordinatorMock.addConsumer(subscriptionId, weather.address);

              return { weather, VRFCoordinatorMock };
          }

          describe("#Weather-requestRandomWords", async function () {
              describe("success", async function () {
                  it("Weather should successfully request a random number will expect VRFCoordinator Event", async function () {
                      const { weather, VRFCoordinatorMock } = await loadFixture(
                          deployWeatherFixture
                      );
                      await expect(weather.requestRandomWords()).to.emit(
                          VRFCoordinatorMock,
                          "RandomWordsRequested"
                      );
                  });

                  it("Weather should successfully fire event 'WeatherTypeUpdate' on callback", async function () {
                      const { weather, VRFCoordinatorMock } = await loadFixture(
                          deployWeatherFixture
                      );

                      await new Promise(async (resolve, reject) => {
                          weather.once("WeatherTypeUpdate", async () => {
                              console.log("WeatherTypeUpdate event fired!");
                              const randomNumber = await weather.getRandomWord();
                              console.log(`Weather randomNumber: ${randomNumber}`);
                              const indexWeatherType = await weather.getIndexWeatherType();
                              console.log(`indexWeatherType: ${indexWeatherType}`);
                              const weatherType = await weather.getWeatherType();
                              console.log(`weatherType: ${weatherType}`);
                              // assert throws an error if it fails, so we need to wrap
                              // it in a try/catch so that the promise returns event
                              // if it fails.
                              try {
                                  assert(
                                      randomNumber.gt(ethers.constants.Zero),
                                      "Weather random number is greater than zero."
                                  );
                                  assert(
                                      indexWeatherType.gte(ethers.constants.Zero),
                                      "Weather index weather type is greater than or equal to zero."
                                  );
                                  assert(
                                      indexWeatherType.lte(ethers.BigNumber.from("18")),
                                      "Weather index weather type is lesser than or equal to 18."
                                  );
                                  resolve();
                              } catch (e) {
                                  reject(e);
                              }
                          });
                          await weather.requestRandomWords();
                          const requestId = await weather.getRequestId();
                          VRFCoordinatorMock.fulfillRandomWords(requestId, weather.address);
                      });
                  });
              });
          });
      });
