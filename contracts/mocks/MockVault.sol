// SPDX-License-Identifier: Unlicensed

pragma solidity =0.8.9;

contract MockVault {
    function getPriorVotes(address, uint256) external pure returns (uint96) {
        return 1000 * 10**18;
    }
}
