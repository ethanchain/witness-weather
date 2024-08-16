// SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract Weather is VRFConsumerBaseV2Plus {
    /** Type declarations */
    /** Enums */
    enum WeatherType {
        SUNNY, // Sunny
        CLOUDY, // Cloudy
        OVERCAST, // Overcast
        RAINY, // Rainy
        LIGHT_RAIN, // Light Rain
        MODERATE, // Moderate Rain
        HEAVY_RAIN, // Heavy Rain
        SHOWER, // Shower
        THUNDERSTORM, // Thunderstorm
        SNOWY, // Snowy
        LIGHT_SNOW, // Light Snow
        HEAVY_SNOW, // Heavy Snow
        SLEET, // Sleet
        FOG, // Fog
        HAZE, // Haze
        HAIL, // Hail
        WINDY, // Windy
        TYPHOON, // Typhoon
        TORNADO // Tornado
    }

    /** Variables declarations */
    //immutable
    // subscription ID.
    uint256 private immutable i_subscriptionId;

    // The gas lane to use, which specifies the maximum gas price to bump to.
    // For a list of available gas lanes on each network,
    // see https://docs.chain.link/docs/vrf-contracts/#configurations
    bytes32 private immutable i_keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 100000;

    // The default is 3, but you can set this higher.
    uint16 private constant REQUEST_CONFIRMATIONS = 3;

    // Cannot exceed VRFCoordinatorV2.MAX_NUM_WORDS.
    uint32 private constant NUM_WORDS = 1;

    // constant
    uint16 private constant WEATHER_TYPE_NUMBER = 19;

    // storage
    uint256 private s_indexWeatherType;
    uint256 private s_randomWord;
    uint256 private s_requestId;

    /** Events */
    event WeatherTypeUpdate(uint256 indexWeatherType);

    /** Constructor declarations */
    constructor(
        uint256 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        i_keyHash = keyHash;
        i_subscriptionId = subscriptionId;
    }

    /**
     * @notice Requests randomness
     * Assumes the subscription is funded sufficiently; "Words" refers to unit of data in Computer Science
     * onlyOwner
     */
    function requestRandomWords() external {
        // Will revert if subscription is not set and funded.
        s_requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: i_keyHash,
                subId: i_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    // Set nativePayment to true to pay for VRF requests with Sepolia ETH instead of LINK
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
    }

    /**
     * @notice Callback function used by VRF Coordinator
     *
     *
     * @param randomWords - array of random results from VRF Coordinator
     */
    function fulfillRandomWords(
        uint256 /** requestId */,
        uint256[] calldata randomWords
    ) internal override {
        s_randomWord = randomWords[0];
        s_indexWeatherType = (s_randomWord % WEATHER_TYPE_NUMBER);
        emit WeatherTypeUpdate(s_indexWeatherType);
    }

    /** view/pure function */
    function getRandomWord() public view returns (uint256) {
        return s_randomWord;
    }

    function getIndexWeatherType() public view returns (uint256) {
        return s_indexWeatherType;
    }

    function getWeatherType() public view returns (WeatherType) {
        return WeatherType(s_indexWeatherType);
    }

    function getRequestId() public view returns (uint256) {
        return s_requestId;
    }
}
