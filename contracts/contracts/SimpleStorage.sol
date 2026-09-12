// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SimpleStorage
 * @notice A minimal contract that stores a uint256 value and an address.
 *         Used to demonstrate read/write interactions via Hardhat.
 */
contract SimpleStorage {
    uint256 public storedValue;
    address public lastUpdater;

    event ValueChanged(address indexed updater, uint256 newValue);

    constructor(uint256 initialValue) {
        storedValue = initialValue;
        lastUpdater = msg.sender;
        emit ValueChanged(msg.sender, initialValue);
    }

    function get() public view returns (uint256) {
        return storedValue;
    }

    function set(uint256 newValue) public {
        storedValue = newValue;
        lastUpdater = msg.sender;
        emit ValueChanged(msg.sender, newValue);
    }
}