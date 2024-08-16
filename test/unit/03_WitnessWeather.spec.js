const { network, ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { networkConfig, developmentChains } = require("../../helper-hardhat-config");
const { makeSureMoonMinutes } = require("../../scripts/helper-functions");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("WitnessWeather Unit Tests", async function () {
          let deployer;

          async function deployWeather() {
              [deployer] = await ethers.getSigners();
              console.log(`deployer address: ${JSON.stringify(deployer)}`);

              const BASE_FEE = "1000000000000000"; // 0.001 ether as bas`e fee
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
              console.log(`weather address: ${weather.address}`);
              return { weather, VRFCoordinatorMock, subscriptionId, keyHash, chainId };
          }
          // We define a fixture to reuse the same setup in every test.
          async function deployWitnessWeatherFixture() {
              const { weather, VRFCoordinatorMock, subscriptionId, keyHash, chainId } =
                  await deployWeather();
              console.log("Mock Aggregator...");
              const DECIMALS = "18";
              const INITIAL_PRICE = "200000000000000000000";

              const ethMockV3AggregatorFactory = await ethers.getContractFactory(
                  "MockV3Aggregator"
              );
              const ethMockV3Aggregator = await ethMockV3AggregatorFactory.deploy(
                  DECIMALS,
                  INITIAL_PRICE
              );
              const ethPriceFeedaddress = ethMockV3Aggregator.address;

              const nativeMockV3AggregatorFactory = await ethers.getContractFactory(
                  "MockV3Aggregator"
              );
              const nativeMockV3Aggregator = await nativeMockV3AggregatorFactory.deploy(
                  DECIMALS,
                  INITIAL_PRICE
              );

              const nativePriceFeedAddress = nativeMockV3Aggregator.address;
              const witnessUsdLowerLimit = networkConfig[chainId]["witnessUsdLowerLimit"];
              const witnessUsdUpperLimit = networkConfig[chainId]["witnessUsdUpperLimit"];
              const ethAddress = networkConfig[chainId]["ethAddress"];
              const timestampOffset = networkConfig[chainId]["timestampOffset"];
              const nativeLimitFee = networkConfig[chainId]["nativeLimitFee"];
              const ethLimitFee = networkConfig[chainId]["ethLimitFee"];

              const witnessWeatherFactory = await ethers.getContractFactory("WitnessWeather");
              //   const keyHash = networkConfig[chainId]["keyHash"];
              const weatherAddress = weather.address;
              const vrfCoordinatorAddress = VRFCoordinatorMock.address;
              const witnessWeather = await witnessWeatherFactory
                  .connect(deployer)
                  .deploy(
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
              return {
                  witnessWeather,
                  weather,
                  VRFCoordinatorMock,
                  timestampOffset,
                  nativeLimitFee,
                  ethLimitFee,
              };
          }

          describe("#checkUpkeep", async function () {
              describe("success", async function () {
                  it("Should be able to call checkUpkeep", async function () {
                      const { witnessWeather } = await loadFixture(deployWitnessWeatherFixture);
                      const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""));
                      const { upkeepNeeded } = await witnessWeather.callStatic.checkUpkeep(
                          checkData
                      );
                      assert.equal(upkeepNeeded, false);
                  });
                  it("Should be pass if WeatherState is BE_READY, time correct, has witness, has enough balance", async function () {
                      const { witnessWeather, timestampOffset } = await loadFixture(
                          deployWitnessWeatherFixture
                      );
                      await witnessWeather.switchBeReadWitnessState();
                      await witnessWeather.witnessWeather(
                          1,
                          "0x0000000000000000000000000000000000000000",
                          {
                              value: ethers.utils.parseEther("1.2"),
                          }
                      );
                      await network.provider.send("evm_increaseTime", [
                          await makeSureMoonMinutes(timestampOffset),
                      ]);
                      await network.provider.request({ method: "evm_mine", params: [] });
                      //   const latestBlock = await ethers.provider.getBlock("latest");
                      //   const blockTimestamp = latestBlock.timestamp;
                      //   console.log(`lastBlockTimestamp: ${blockTimestamp}`);
                      const isCorrectMoon = await witnessWeather.isCorrectNoonMinutes();
                      const beforeWitnessState = await witnessWeather.getWitnessState();
                      const witnessLength = await witnessWeather.getWitnessLength();
                      console.log(
                          `isCorrectMoon: ${isCorrectMoon}, beforeWitnessState: ${beforeWitnessState}, witnessLength: ${witnessLength}`
                      );
                      const currentNativeBalance = await witnessWeather.getCurrentNativeBalance();
                      const currentNativeLimitFee = await witnessWeather.getNativeLimitFee();
                      const currentEthBalance = await witnessWeather.getCurrentEthBalance();
                      const currentEthLimitFee = await witnessWeather.getEthLimitFee();
                      console.log(
                          `currentNativeBalance: ${currentNativeBalance}, currentNativeLimitFee: ${currentNativeLimitFee}, 
                        currentEthBalance: ${currentEthBalance}, currentEthLimitFee: ${currentEthLimitFee}`
                      );
                      await witnessWeather.performUpkeep([]);
                      const finalWitnessState = await witnessWeather.getWitnessState();
                      // upkeepNeeded = (isBeReady && timeFlag && hasWitness && hasEnoughBalance);
                      const { upkeepNeeded } = await witnessWeather.callStatic.checkUpkeep("0x");
                      const isFinalCorrectMoon = await witnessWeather.isCorrectNoonMinutes();
                      assert(finalWitnessState.toString() == "1");
                      assert.equal(isFinalCorrectMoon, upkeepNeeded == false);
                  });
              });
              describe("failure", async function () {
                  it("Should be false if people hasn't send any token", async function () {
                      const { witnessWeather, timestampOffset } = await loadFixture(
                          deployWitnessWeatherFixture
                      );
                      const plusDiff = await makeSureMoonMinutes(timestampOffset);
                      await network.provider.send("evm_increaseTime", [plusDiff]);
                      await network.provider.request({ method: "evm_mine", params: [] });
                      // upkeepNeeded = (isBeReady && timeFlag && hasWitness && hasEnoughBalance);
                      const { upkeepNeeded } = await witnessWeather.callStatic.checkUpkeep("0x");
                      assert(!upkeepNeeded);
                  });

                  it("Should be false if WitnessState is not BE_READY", async function () {
                      const { witnessWeather, timestampOffset } = await loadFixture(
                          deployWitnessWeatherFixture
                      );
                      await witnessWeather.switchBeReadWitnessState();
                      console.log(
                          `WitnessState be ready: ${await witnessWeather.getWitnessState()}`
                      );
                      await witnessWeather.witnessWeather(
                          1,
                          "0x0000000000000000000000000000000000000000",
                          {
                              value: ethers.utils.parseEther("1.2"),
                          }
                      );
                      await network.provider.send("evm_increaseTime", [
                          await makeSureMoonMinutes(timestampOffset),
                      ]);
                      await network.provider.request({ method: "evm_mine", params: [] });
                      await witnessWeather.performUpkeep([]); // changes the state to calculating
                      const witnessState = await witnessWeather.getWitnessState(); // stores the new state
                      console.log(`AfterWinessState: ${witnessState}`);
                      // upkeepNeeded = (isBeReady && timeFlag && hasWitness && hasEnoughBalance);
                      const { upkeepNeeded } = await witnessWeather.callStatic.checkUpkeep("0x");
                      await witnessWeather.switchOpenWitnessState();
                      console.log(
                          `Final witnessState open: ${await witnessWeather.getWitnessState()}`
                      );
                      //OPEN, BE_READY, CALCULATING, CLOSE  <===> 0, 1, 2, 3
                      assert.equal(witnessState.toString() == "1", upkeepNeeded == false);
                  });

                  it("Should be false if witness people don't send enough token", async function () {
                      const { witnessWeather, timestampOffset } = await loadFixture(
                          deployWitnessWeatherFixture
                      );
                      await witnessWeather.switchBeReadWitnessState();
                      await witnessWeather.witnessWeather(
                          1,
                          "0x0000000000000000000000000000000000000000",
                          {
                              value: ethers.utils.parseEther("0.05"),
                          }
                      );
                      const plusDiff = await makeSureMoonMinutes(timestampOffset);
                      await network.provider.send("evm_increaseTime", [plusDiff]);
                      await network.provider.request({ method: "evm_mine", params: [] });
                      // upkeepNeeded = (isBeReady && timeFlag && hasWitness && hasEnoughBalance);
                      const { upkeepNeeded } = await witnessWeather.callStatic.checkUpkeep("0x");
                      assert(!upkeepNeeded);
                  });
              });
          });

          describe("#performUpkeep", async function () {
              describe("success", async function () {
                  it("If upkeepNeeded be true, can call performUpkeep", async function () {
                      const { witnessWeather, timestampOffset } = await loadFixture(
                          deployWitnessWeatherFixture
                      );
                      await witnessWeather.switchBeReadWitnessState();
                      await witnessWeather.witnessWeather(
                          1,
                          "0x0000000000000000000000000000000000000000",
                          {
                              value: ethers.utils.parseEther("1.8"),
                          }
                      );
                      const plusDiff = await makeSureMoonMinutes(timestampOffset);
                      await network.provider.send("evm_increaseTime", [plusDiff]);
                      await network.provider.request({ method: "evm_mine", params: [] });
                      // upkeepNeeded = (isBeReady && timeFlag && hasWitness && hasEnoughBalance);
                      const { upkeepNeeded } = await witnessWeather.callStatic.checkUpkeep("0x");
                      await witnessWeather.performUpkeep([]);
                      assert(upkeepNeeded);
                  });
                  it("If win to witness weather will expect WitnessWeatherSuccess event", async function () {
                      const { witnessWeather, timestampOffset } = await loadFixture(
                          deployWitnessWeatherFixture
                      );
                      await witnessWeather.switchBeReadWitnessState();
                      await witnessWeather.witnessWeather(
                          0,
                          "0x0000000000000000000000000000000000000000",
                          {
                              value: ethers.utils.parseEther("1.8"),
                          }
                      );
                      const plusDiff = await makeSureMoonMinutes(timestampOffset);
                      await network.provider.send("evm_increaseTime", [plusDiff]);
                      await network.provider.request({ method: "evm_mine", params: [] });
                      await expect(witnessWeather.performUpkeep([])).to.emit(
                          witnessWeather,
                          "WitnessWeatherSuccess"
                      );
                  });

                  it("The winner of witness weather to calculating", async function () {
                      const {
                          witnessWeather,
                          timestampOffset,
                          weather,
                          VRFCoordinatorMock,
                          nativeLimitFee,
                      } = await loadFixture(deployWitnessWeatherFixture);
                      await witnessWeather.switchBeReadWitnessState();
                      const signers = await ethers.getSigners();
                      const signer = signers[2];
                      let startingBalance = await signer.getBalance();
                      console.log(`startingBalance: ${startingBalance}`);
                      const tx = await witnessWeather
                          .connect(signer)
                          .witnessWeather(0, "0x0000000000000000000000000000000000000000", {
                              value: ethers.utils.parseEther("1.8"),
                          });
                      const receipt = await tx.wait(1);
                      const gasUsed = receipt.gasUsed; // Gas used quantity
                      const gasPrice = tx.gasPrice; // Per unit gas price（Wei）
                      const totalGasCost = gasUsed.mul(gasPrice); // Total gas cost（Wei）
                      console.log(`totalGasCost: ${totalGasCost}`);
                      const plusDiff = await makeSureMoonMinutes(timestampOffset);
                      // InvalidArgumentsError: data did not match any variant of untagged enum U64OrUsize . It's sovled
                      await network.provider.send("evm_increaseTime", [plusDiff]);
                      await network.provider.request({ method: "evm_mine", params: [] });
                      witnessWeather.performUpkeep([]);

                      await new Promise(async (resolve, reject) => {
                          witnessWeather.once("WitnessWeatherSuccess", async () => {
                              console.log("WitnessWeatherSuccess event fired.");
                              try {
                                  const witnessBalance = await signer.getBalance();
                                  const witnessState = await witnessWeather.getWitnessState();
                                  assert.equal(witnessState.toString(), "1");
                                  const endingBalance = witnessBalance
                                      .add(ethers.BigNumber.from(nativeLimitFee))
                                      .add(totalGasCost);
                                  console.log(
                                      `witnessBalance: ${witnessBalance}, endingBalance: ${endingBalance}`
                                  );
                                  assert.equal(
                                      startingBalance.toString(),
                                      endingBalance.toString()
                                  );
                                  resolve();
                              } catch (e) {
                                  reject(e);
                              }
                          });
                      });
                      try {
                          await weather.requestRandomWords();
                          const requestId = await weather.getRequestId();
                          VRFCoordinatorMock.fulfillRandomWords(requestId, weather.address);
                      } catch (e) {
                          reject(e);
                      }
                  });
              });

              describe("failure", async function () {
                  it("If direct call performUpkeep when upkeepNeeded is false, performUpkeep will revert", async function () {
                      const { witnessWeather } = await loadFixture(deployWitnessWeatherFixture);
                      await expect(witnessWeather.performUpkeep([])).to.be.revertedWith(
                          "Condition not met"
                      );
                  });
                  it("If not win to witness weather there is no expect WitnessWeatherSuccess event", async function () {
                      const { witnessWeather, timestampOffset } = await loadFixture(
                          deployWitnessWeatherFixture
                      );
                      await witnessWeather.switchBeReadWitnessState();
                      await witnessWeather.witnessWeather(
                          5,
                          "0x0000000000000000000000000000000000000000",
                          {
                              value: ethers.utils.parseEther("1.8"),
                          }
                      );
                      const plusDiff = await makeSureMoonMinutes(timestampOffset);
                      await network.provider.send("evm_increaseTime", [plusDiff]);
                      await network.provider.request({ method: "evm_mine", params: [] });
                      await expect(witnessWeather.performUpkeep([])).not.be.emit(
                          witnessWeather,
                          "WitnessWeatherSuccess"
                      );
                  });
              });
          });
      });
