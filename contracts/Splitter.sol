//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/// @title Splitter contract
/// @notice Split Ether & ERC20 payments among a list of accounts
contract Splitter is Ownable {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // user share list
    mapping (address => uint) public userShares;
    // user share total
    uint public userShareSum;

    // pool count
    Counters.Counter private poolIds;

    // Pool Info record struct
    struct PoolInfo {
        address token;      // pool deposit token address, 0 for ETH pool
        uint balance;       // ETH/ERC20 amount deposited
        uint depositTime;   // deposit time, streaming starts
        uint period;        // streaming time in secs
        mapping (address => uint) withdrawnAmounts;   // withdrawn ETH/ERC20 amount for each user
    }
    // pool info list
    mapping (uint => PoolInfo) public pools;

    uint public constant DEFAULT_POOL_PERIOD = 2592000;

    event UpdateUserShare(address[] users, uint[] shares);
    event Deposit(uint indexed poolId, address indexed depositor, uint amount, uint period);
    event DepositToken(uint indexed poolId, address depositor, address indexed token, uint amount, uint period);
    event Withdraw(uint indexed poolId, address indexed user, uint amount);

    /**
     * @dev constructor
     * @notice set user share
     * @param _users:address[] user list
     * @param _shares:uint[] share list
     */
    constructor(address[] memory _users, uint[] memory _shares) {
        updateUserShare(_users, _shares);
    }

    /**
     * @dev receive
     * @notice creates pool with ETH deposited, period is set default value
     */
    receive() external payable {
        deposit(DEFAULT_POOL_PERIOD);
    }

    /**
     * @dev updateUserShare
     * @notice updateUserShare and userShareSum
     * @param _users:address[] user list
     * @param _shares:uint[] share list
     */
    function updateUserShare(address[] memory _users, uint[] memory _shares) public onlyOwner {
        uint userLen = _users.length;
        uint shareLen = _shares.length;
        require(userLen > 0, "Splitter: empty input");
        require(userLen == shareLen, "Splitter: length not match");

        for (uint i = 0; i < userLen; i++) {
            userShareSum = userShareSum - userShares[_users[i]] + _shares[i];
            userShares[_users[i]] = _shares[i];
        }

        emit UpdateUserShare(_users, _shares);
    }

    /**
     * @dev deposit
     * @notice create a pool with ETH deposited 
     * @param _period:uint streaming length of pool
     */
    function deposit(uint _period) public payable {
        require(_period > 0, "Splitter: invalid pool period");

        poolIds.increment();
        uint newPoolId = poolIds.current();
        PoolInfo storage pool = pools[newPoolId];
        pool.token = address(0);
        pool.balance = msg.value;
        pool.depositTime = block.timestamp;
        pool.period = _period;

        emit Deposit(newPoolId, msg.sender, msg.value, _period);
    }

    /**
     * @dev depositToken
     * @notice create a pool with ERC20 token deposited
     * @param _token:address ERC20 token address
     * @param _amount:uint amount of ERC20 token to be deposited
     * @param _period:uint streaming length of pool
     */
    function depositToken(address _token, uint _amount, uint _period) public {
        require(_token != address(0), "Splitter: invalid token address");
        require(_amount > 0, "Splitter: insufficient deposit");
        require(_period > 0, "Splitter: invalid pool period");

        poolIds.increment();
        uint newPoolId = poolIds.current();
        PoolInfo storage pool = pools[newPoolId];
        pool.token = _token;
        pool.balance = _amount;
        pool.depositTime = block.timestamp;
        pool.period = _period;
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit DepositToken(newPoolId, msg.sender, _token, _amount, _period);
    }

    /**
     * @dev withdraw
     * @notice withdraw aggregated amount of ETH/ERC20 token to the caller from the pool
     * @param _poolId:uint pool id to withdraw from
     */
    function withdraw(uint _poolId) public {
        PoolInfo storage pool = pools[_poolId];
        require(userShares[msg.sender] > 0, "Splitter: no pool share");
        require(_poolId <= poolIds.current(), "Splitter: invalid pool id");
        uint withdrawableAmount = getWithdrawableAmount(pool);
        pool.withdrawnAmounts[msg.sender] += withdrawableAmount;

        if (pool.token == address(0)) {
            (bool success, ) = payable(msg.sender).call{ value: withdrawableAmount }("");
            require(success, "Splitter: ETH withdraw failed");
        } else
            IERC20(pool.token).safeTransfer(msg.sender, withdrawableAmount);

        emit Withdraw(_poolId, msg.sender, withdrawableAmount);
    }

    /**
     * @dev getWithdrawableAmount
     * @notice internal function to get user withdrawable amount(aggregated - withdrawn)
     * @param _pool:PoolInfo pool to withdraw from
     */
    function getWithdrawableAmount(PoolInfo storage _pool) internal view returns (uint) {
        uint aggregatedAmount = _pool.balance;
        if (block.timestamp < _pool.depositTime + _pool.period)
            aggregatedAmount = aggregatedAmount * (block.timestamp - _pool.depositTime) / _pool.period;
        aggregatedAmount = aggregatedAmount * userShares[msg.sender] / userShareSum;

        return aggregatedAmount - _pool.withdrawnAmounts[msg.sender];
    }
}
