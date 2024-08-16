// SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

library PriceConverter {
    /**
     * Get last new price
     *
     * @param _priceFeed Feed price contract
     */
    function getLastPrice(
        AggregatorV3Interface _priceFeed
    ) internal view returns (uint256) {
        (, int256 price, , , ) = _priceFeed.latestRoundData();
        // WETH(BNB)/USD rate 18 digital
        return uint256(price * 10 ** 10);
    }

    function getConversionPrice(
        uint256 _amount,
        AggregatorV3Interface _priceFeed
    ) internal view returns (uint256) {
        uint256 tokenPrice = getLastPrice(_priceFeed);
        uint256 tokenInUsdPrice = (tokenPrice * _amount) / 10 ** 18;
        // The actual token convert usd price
        return tokenInUsdPrice;
    }
}
