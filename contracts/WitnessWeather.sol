// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import {IBEP20} from "./interfaces/IBEP20.sol";
import "./libraries/PriceConverter.sol";
import {Weather} from "./Weather.sol";
// AutomationCompatible.sol imports the functions from both ./AutomationBase.sol and ./interfaces/AutomationCompatibleInterface.sol
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

// import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract WitnessWeather is Weather, AutomationCompatibleInterface {
    /** Type declarations */
    /** Enums */
    enum WitnessState {
        OPEN,
        BE_READY,
        CALCULATING,
        CLOSE
    }

    /** Variables declarations */
    //immutable
    // subscription ID.
    // uint256 private immutable i_subscriptionId;

    // The gas lane to use, which specifies the maximum gas price to bump to.
    // For a list of available gas lanes on each network,
    // see https://docs.chain.link/docs/vrf-contracts/#configurations
    // bytes32 private immutable i_keyHash;

    // Join witness usd lower limit
    uint256 private immutable i_witnessUsdLowerLimit;
    // Join witness usd upper limit
    uint256 private immutable i_witnessUsdUpperLimit;
    // WETH price feed address
    address private immutable i_ethPriceFeedAddress;
    // WETH price feed
    AggregatorV3Interface private immutable i_ethPriceFeed;
    // native price feed address
    address private immutable i_nativePriceFeedAddress;
    // native price feed
    AggregatorV3Interface private immutable i_nativePriceFeed;
    // WETH address
    address private immutable i_ethAddress;
    // Current address timestamp offset
    int256 private immutable i_timestampOffset;

    uint256 private immutable i_nativeLimitFee;

    uint256 private immutable i_ethLimitFee;

    // constant
    // uint16 private constant WEATHER_TYPE_NUMBER = 19;
    // uint32 private constant CALLBACK_GAS_LIMIT = 100000;

    // The default is 3, but you can set this higher.
    // uint16 private constant REQUEST_CONFIRMATIONS = 3;

    // Cannot exceed VRFCoordinatorV2.MAX_NUM_WORDS.
    // uint32 private constant NUM_WORDS = 1;
    uint256 private constant MINIMUM_USD = 10 * 10 ** 18;
    uint256 private constant INTERVAL_TIME = 10 * 60;

    // storage
    // uint256 private s_indexWeatherType;
    // uint256 private s_randomWord;
    WitnessState private s_witnessState;
    // address payable[] private s_witnesses;
    uint256[] private s_currentChooseWeather;
    // Current ETH balance
    uint256 private s_currentEthBalance;
    // Current native balance
    uint256 private s_currentNativeBalance;
    mapping(uint256 => address payable[]) private s_currentWeatherShineWitnesses;
    mapping(address => WitnessBonus) private s_keepWitnessBonus;

    Weather private s_weather;
    uint256 private s_lastTimestamp;

    /** Events */
    // event WeatherTypeUpdate(uint256 indexWeatherType);
    event WitnessWeatherSuccess(address indexed _witnessAddress);
    event KeepNativeBonusOnce(address indexed _witnessAddress, uint256 _amount);
    event KeepEthBonusOnce(address indexed _witnessAddress, uint256 _amount);

    /** Strcuts */
    struct WitnessBonus {
        uint256 nativeBonus;
        uint256 ethBonus;
    }

    /** Errors */
    error Witness_NotEnoughConvertedUsd();
    error Witness_BelowWitnessUsdLowerLimit();
    error Witness_ExceedWitnessUsdUpperLimit();
    error Witness_SwitchBeReadMustOpenState();
    error Witnees_NotEnoughBonusWithdraw();

    /** Constructor declarations */
    constructor(
        uint256 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash,
        address weatherAddress,
        uint256 witnessUsdLowerLimit,
        uint256 witnessUsdUpperLimit,
        address ethPriceFeedaddress,
        address nativePriceFeedAddress,
        address ethAddress,
        int256 timestampOffset,
        uint256 nativeLimitFee,
        uint256 ethLimitFee
    ) Weather(subscriptionId, vrfCoordinator, keyHash) {
        s_weather = Weather(weatherAddress);
        i_witnessUsdLowerLimit = witnessUsdLowerLimit;
        i_witnessUsdUpperLimit = witnessUsdUpperLimit;
        i_ethPriceFeedAddress = ethPriceFeedaddress;
        i_ethPriceFeed = AggregatorV3Interface(ethPriceFeedaddress);
        i_nativePriceFeedAddress = nativePriceFeedAddress;
        i_nativePriceFeed = AggregatorV3Interface(nativePriceFeedAddress);
        i_ethAddress = ethAddress;
        i_timestampOffset = timestampOffset;
        i_nativeLimitFee = nativeLimitFee;
        i_ethLimitFee = ethLimitFee;
        s_witnessState = WitnessState.OPEN;
        s_lastTimestamp = block.timestamp;
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        require(upkeepNeeded, "Condition not met");
        s_witnessState = WitnessState.CALCULATING;
        s_weather.requestRandomWords();
        uint256 weatherTypeIndex = s_weather.getIndexWeatherType();
        address payable[] memory winnerWitnesses = getWitnesses(weatherTypeIndex);
        uint256 len = winnerWitnesses.length;
        if (len > 0) {
            if (s_currentNativeBalance > i_nativeLimitFee) {
                s_currentNativeBalance -= i_nativeLimitFee;
            } else {
                s_currentEthBalance -= i_ethLimitFee;
            }
            uint256 _nativeBonusTmp = s_currentNativeBalance / len;
            uint256 _ethBonusTmp = s_currentEthBalance / len;
            for (uint256 i = 0; i < len; i++) {
                address payable currentWitness = winnerWitnesses[i];
                if (_nativeBonusTmp > 0) {
                    (bool success, ) = currentWitness.call{value: _nativeBonusTmp}("");
                    if (!success) {
                        WitnessBonus memory _witnessBonus = getWitnessBonus(currentWitness);
                        uint256 _nativeBonus = _witnessBonus.nativeBonus;
                        _nativeBonus += _ethBonusTmp;
                        setWitnessBonus(currentWitness, _nativeBonus, _witnessBonus.ethBonus);
                        emit KeepNativeBonusOnce(currentWitness, _ethBonusTmp);
                    }
                }
                if (_ethBonusTmp > 0) {
                    (bool success, ) = currentWitness.call{value: _ethBonusTmp}("");
                    if (!success) {
                        WitnessBonus memory _witnessBonus = getWitnessBonus(currentWitness);
                        uint256 _ethBonus = _witnessBonus.ethBonus;
                        _ethBonus += _ethBonusTmp;
                        setWitnessBonus(currentWitness, _witnessBonus.nativeBonus, _ethBonus);
                        emit KeepEthBonusOnce(currentWitness, _ethBonusTmp);
                    }
                }
                emit WitnessWeatherSuccess(currentWitness);
            }
        }
        uint256[] memory currentChooseWeather = s_currentChooseWeather;
        for (uint256 i = 0; i < currentChooseWeather.length; i++) {
            clearWitnesses(currentChooseWeather[i]);
        }
        delete s_currentChooseWeather;
        s_currentEthBalance = 0;
        s_currentNativeBalance = 0;
        s_witnessState = WitnessState.BE_READY;
        s_lastTimestamp = block.timestamp;
    }

    // Is current correct moon minutes
    function isCorrectNoonMinutes() public view returns (bool) {
        int256 correctTimestamp = int256(block.timestamp) + i_timestampOffset;
        int256 _hours = (correctTimestamp / 60 / 60) % 24;
        int256 _minutes = (correctTimestamp / 60) % 60;
        // 12:00 ~ 12:10
        return _hours == 12 && _minutes <= 10;
    }

    /**
     * @dev This is a function that the chainlink automation nodes call
     * the look for the `upkeepNeeded` to return true.
     * The following should be true in order to return true
     */
    function checkUpkeep(
        bytes memory /* checkData */
    ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isBeReady = (WitnessState.BE_READY == s_witnessState);
        bool intervalFlag = (block.timestamp - s_lastTimestamp) > INTERVAL_TIME;
        bool timeFlag = isCorrectNoonMinutes();
        bool hasWitness = (s_currentChooseWeather.length > 0);
        bool hasEnoughBalance = (s_currentNativeBalance > i_nativeLimitFee ||
            s_currentEthBalance > i_ethLimitFee);
        upkeepNeeded = (isBeReady && intervalFlag && timeFlag && hasWitness && hasEnoughBalance);
        return (upkeepNeeded, "0x0"); // Remove the warning
    }

    function setWitnessBonus(
        address _witnessAddress,
        uint256 _nativeBonus,
        uint256 _ethBonus
    ) private {
        s_keepWitnessBonus[_witnessAddress] = WitnessBonus(_nativeBonus, _ethBonus);
    }

    /**
     * @dev Join to witness weather
     *
     * @param _weatherType the weather type
     * @param _token token address
     */
    function witnessWeather(uint256 _weatherType, address _token) public payable {
        require(s_witnessState == WitnessState.BE_READY, "Please try again later");
        uint256 chainId = getChainId();
        if (chainId == 56 || chainId == 97) {
            handleBscnet(_token, msg.value, msg.sender);
        } else if (chainId == 1 || chainId == 31337) {
            handleMainnet(msg.value);
        }
        s_currentChooseWeather.push(_weatherType);
        addWitness(_weatherType, payable(msg.sender));
    }

    function handleMainnet(uint256 _amount) private {
        require(_amount > 0, "Must send ETH");
        checkNativeOfUsdAmount(_amount);
        // Handle native
        handleNativePayment(_amount);
    }

    function handleBscnet(address _token, uint256 _amount, address _sender) private {
        // native or WETH/ETH
        if (_token == address(0)) {
            // native token
            require(_amount > 0, "Must send native BNB");
            checkNativeOfUsdAmount(_amount);
            // Handle native
            handleNativePayment(_amount);
        } else if (_token == i_ethAddress) {
            // ETH
            require(_amount == 0, "Do not send BNB");
            uint256 tokenAmount = IBEP20(_token).balanceOf(_sender);
            require(tokenAmount > 0, "Insufficient ETH balance");
            checkEthOfUsdAmount(tokenAmount);
            // Transfer token to contract
            // IBEP20(_weth).transfer(address(this), wethAmount);
            bool success = IBEP20(_token).transferFrom(_sender, address(this), tokenAmount);
            require(success, "ETH transfer failed");
            // Handle BEP20
            handleBEP20Payment(tokenAmount);
        } else {
            revert("Invalid token address");
        }
    }

    // Check the minimum amount of usd
    function checkMinimumUsdAmount(uint256 _usdAmount) private pure {
        if (_usdAmount < MINIMUM_USD) {
            revert Witness_NotEnoughConvertedUsd();
        }
    }

    function checkNativeOfUsdAmount(uint256 _amount) private view {
        uint256 usdAmount = PriceConverter.getConversionPrice(_amount, i_nativePriceFeed);
        checkUsdLimit(usdAmount);
    }

    function checkUsdLowerLimit(uint256 _amount) private view {
        if (_amount < i_witnessUsdLowerLimit) {
            revert Witness_BelowWitnessUsdLowerLimit();
        }
    }

    function checkUsdUpperLimit(uint256 _amount) private view {
        if (_amount > i_witnessUsdUpperLimit) {
            revert Witness_ExceedWitnessUsdUpperLimit();
        }
    }

    function checkUsdLimit(uint256 _usdAmount) private view {
        if (i_witnessUsdLowerLimit > 0) {
            checkUsdLowerLimit(_usdAmount);
        } else {
            checkMinimumUsdAmount(_usdAmount);
        }
        if (i_witnessUsdUpperLimit > 0 && i_witnessUsdUpperLimit > i_witnessUsdLowerLimit) {
            checkUsdUpperLimit(_usdAmount);
        }
    }

    function checkEthOfUsdAmount(uint256 _amount) private view {
        uint256 usdAmount = PriceConverter.getConversionPrice(_amount, i_ethPriceFeed);
        checkUsdLimit(usdAmount);
    }

    // Handle native payment
    function handleNativePayment(uint256 _amount) private {
        s_currentNativeBalance += _amount;
    }

    // Handle BEP20 payment
    function handleBEP20Payment(uint256 _amount) private {
        s_currentEthBalance += _amount;
    }

    // Add weater type and witness address into mapping
    function addWitness(uint256 weatherType, address payable _witness) private {
        s_currentWeatherShineWitnesses[weatherType].push(_witness);
    }

    // Fetch array of the key
    function getWitnesses(uint256 weatherType) private view returns (address payable[] memory) {
        return s_currentWeatherShineWitnesses[weatherType];
    }

    // Clear array of the key
    function clearWitnesses(uint256 weatherType) private {
        delete s_currentWeatherShineWitnesses[weatherType];
    }

    function withdrawNativeWitnessBonus() public payable {
        // payable(msg.sender).transfer(address(this).balance);
        WitnessBonus memory _witnessBonus = getWitnessBonus(msg.sender);
        if (_witnessBonus.nativeBonus > 0) {
            (bool success, ) = msg.sender.call{value: _witnessBonus.nativeBonus}("");
            require(success, "Native token withdraw failed");
        } else {
            revert Witnees_NotEnoughBonusWithdraw();
        }
    }

    function withdrawEthWitnessBonus() public payable {
        WitnessBonus memory _witnessBonus = getWitnessBonus(msg.sender);
        if (_witnessBonus.ethBonus > 0) {
            bool success = IBEP20(i_ethAddress).transferFrom(
                address(this),
                msg.sender,
                _witnessBonus.ethBonus
            );
            require(success, "ETH withdraw failed");
        } else {
            revert Witnees_NotEnoughBonusWithdraw();
        }
    }

    function switchCloseWitnessState() public onlyOwner {
        s_witnessState = WitnessState.CLOSE;
    }

    function switchOpenWitnessState() public onlyOwner {
        s_witnessState = WitnessState.OPEN;
    }

    function switchBeReadWitnessState() public onlyOwner {
        if (s_witnessState != WitnessState.OPEN) {
            revert Witness_SwitchBeReadMustOpenState();
        }
        s_witnessState = WitnessState.BE_READY;
    }

    /** Get Method View/Pure Functions */
    function getCurrentNativeBalance() public view returns (uint256) {
        return s_currentNativeBalance;
    }

    function getCurrentEthBalance() public view returns (uint256) {
        return s_currentEthBalance;
    }

    function getNativeLimitFee() public view returns (uint256) {
        return i_nativeLimitFee;
    }

    function getEthLimitFee() public view returns (uint256) {
        return i_ethLimitFee;
    }

    function getWitnessBonus(address _witnessAddress) public view returns (WitnessBonus memory) {
        return s_keepWitnessBonus[_witnessAddress];
    }

    // Get chain id
    function getChainId() public view returns (uint256) {
        return block.chainid;
    }

    function getTimestampOffset() public view returns (int256) {
        return i_timestampOffset;
    }

    function getWitnessState() public view returns (WitnessState) {
        return s_witnessState;
    }

    function getWitnessLength() public view returns (uint256) {
        return s_currentChooseWeather.length;
    }

    function getLastTimestamp() public view returns (uint256) {
        return s_lastTimestamp;
    }

    function getIntervalTime() public pure returns (uint256) {
        return INTERVAL_TIME;
    }

    function getIntervalFlag() public view returns (bool) {
        return (block.timestamp - s_lastTimestamp) > INTERVAL_TIME;
    }
}
