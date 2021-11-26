// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later
pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISynth is IERC20 {
    function mint(address to, uint256 amount) external;

    function burn(uint256 amount) external;
}
