# Splitter
## Requirements
### Main Objective
Create a contract that allows to split Ether & ERC20 payments among a list of accounts.
The amounts can be in equal parts or in any other arbitrary proportion. The way this
should be handled is by assigning each account a number of shares. The payments should
not be forwarded to the accounts automatically but kept in the contract. The actual
transfer should be triggered by a separate call by each recipient account.

**Example**

_List of addresses:_
- 0x047425f8d784dcc6d73df12bc6eeca3aa51f4fb2
- 0x522eb82b8394f1abc499be2b986b79feaf7e451e

_Shares:_
- 30%
- 70%
1 ETH is being split:

_The result:_
- 0x047425f8d784dcc6d73df12bc6eeca3aa51f4fb2 should be able to withdraw 0.3 ETH
- 0x522eb82b8394f1abc499be2b986b79feaf7e451e should be able to withdraw 0.7 ETH

### Bonus Task
Let the sender specify time for releasing of the funds to simulate “money streaming”

**Example**

_List of addresses:_
- 0x047425f8d784dcc6d73df12bc6eeca3aa51f4fb2
- 0x522eb82b8394f1abc499be2b986b79feaf7e451e

_Shares:_
- 30%
- 70%

_Streaming time:_
- 2592000 (~1 month)

1 ETH is being split:

_The result:_
- 0x047425f8d784dcc6d73df12bc6eeca3aa51f4fb2 should be able to withdraw 0,000000115740741 ETH every second that passes up to 0.7 ETH after 1 month
- 0x522eb82b8394f1abc499be2b986b79feaf7e451e should be able to withdraw 0,000000270061728 ETH every second up to 0.7 ETH after 1 month

## Configuration
First you need to create a .env file (or rename .env.example) to set `ETHERSCAN_API_KEY`, `ALCHEMY_API_KEY` and `PRIVATE_KEY` and run the following command to install dependencies.
```
npm install
```

## Test
```
npx hardhat test
```

You can check the gas report, set the `REPORT_GAS` value `true` and run the same command.
```
·---------------------------------|----------------------------|-------------|-----------------------------·
|       Solc version: 0.8.4       ·  Optimizer enabled: false  ·  Runs: 200  ·  Block limit: 30000000 gas  │
··································|····························|·············|······························
|  Methods                                                                                                 │
··············|···················|··············|·············|·············|···············|··············
|  Contract   ·  Method           ·  Min         ·  Max        ·  Avg        ·  # calls      ·  usd (avg)  │
··············|···················|··············|·············|·············|···············|··············
|  MockERC20  ·  approve          ·           -  ·          -  ·      46894  ·            9  ·          -  │
··············|···················|··············|·············|·············|···············|··············
|  Splitter   ·  deposit          ·      115027  ·     115039  ·     115032  ·            7  ·          -  │
··············|···················|··············|·············|·············|···············|··············
|  Splitter   ·  depositToken     ·      175063  ·     175087  ·     175077  ·            7  ·          -  │
··············|···················|··············|·············|·············|···············|··············
|  Splitter   ·  updateUserShare  ·       46615  ·      69216  ·      54149  ·            3  ·          -  │
··············|···················|··············|·············|·············|···············|··············
|  Splitter   ·  withdraw         ·       52336  ·      98696  ·      71056  ·           18  ·          -  │
··············|···················|··············|·············|·············|···············|··············
|  Deployments                    ·                                          ·  % of limit   ·             │
··································|··············|·············|·············|···············|··············
|  MockERC20                      ·           -  ·          -  ·    1229411  ·        4.1 %  ·          -  │
··································|··············|·············|·············|···············|··············
|  Splitter                       ·           -  ·          -  ·    2159554  ·        7.2 %  ·          -  │
·---------------------------------|--------------|-------------|-------------|---------------|-------------·
```

You can also check the test coverage by using the following command and check the `./coverage/index.html` file.
```
npx hardhat coverage
```

```
-----------------|----------|----------|----------|----------|----------------|
File             |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
-----------------|----------|----------|----------|----------|----------------|
 contracts/      |      100 |    95.45 |      100 |      100 |                |
  Splitter.sol   |      100 |    95.45 |      100 |      100 |                |
 contracts/test/ |      100 |      100 |      100 |      100 |                |
  MockERC20.sol  |      100 |      100 |      100 |      100 |                |
-----------------|----------|----------|----------|----------|----------------|
All files        |      100 |    95.45 |      100 |      100 |                |
-----------------|----------|----------|----------|----------|----------------|
```

![Screenshot 2022-04-18 13:56:52](https://user-images.githubusercontent.com/45418310/163851894-067ac1c2-c139-40b5-a16e-aa6f4044a77c.png)
