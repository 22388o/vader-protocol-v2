const { advanceBlock } = require("@openzeppelin/test-helpers/src/time");

const {
    // Deployment Function
    deployMock,

    // Testing Utilities
    assertBn,
    assertErrors,
    assertEvents,
    UNSET_ADDRESS,
    DEFAULT_CONFIGS,
    TEN_UNITS,

    // Library Functions
    verboseAccounts,
    time,
    big,
    parseUnits,

    // Project Specific Constants
    PROJECT_CONSTANTS,

    mintAndApprove,
    MockAggregatorV3,
    UniswapV2Pair,
} = require("../utils")(artifacts);

contract("Twap Oracle", (accounts) => {
    describe("construction", () => {
        it("should construct the twap", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { twap, mockUsdv, vader } = await deployMock(accounts);

            // Owner should be set
            assert.notEqual(await twap.owner(), UNSET_ADDRESS);

            // VADER and USDV still unset
            assert.equal(await twap.VADER(), UNSET_ADDRESS);
            assert.equal(await twap.USDV(), UNSET_ADDRESS);

            await twap.initialize(mockUsdv.address, vader.address);

            // VADER and USDV now set
            assert.equal(await twap.VADER(), vader.address);
            assert.equal(await twap.USDV(), mockUsdv.address);
        });
    });

    describe("pair exists", () => {
        it("should check if the pair exists and return the pair", async () => {
            const { twap, mockUsdv, dai } = await deployMock();

            assert.notEqual(
                await twap.pairExists(
                    await mockUsdv.address,
                    await dai.address
                ),
                true
            );
        });
    });

    describe("register aggregator", () => {
        it("should not allow to register with bad arguments", async () => {
            const { twap, mockUsdv } = await deployMock();

            await assertErrors(
                twap.registerAggregator(UNSET_ADDRESS, UNSET_ADDRESS),
                "TwapOracle::registerAggregator: asset zero address provided"
            );

            await assertErrors(
                twap.registerAggregator(mockUsdv.address, UNSET_ADDRESS),
                "TwapOracle::registerAggregator: aggregator zero address provided"
            );
        });

        it("should not allow to register when already exists", async () => {
            const { twap, mockUsdv } = await deployMock();

            const USDVAggregator = await MockAggregatorV3.new(
                mockUsdv.address,
                parseUnits(1, 8)
            );

            await twap.registerAggregator(
                mockUsdv.address,
                USDVAggregator.address
            );

            await assertErrors(
                twap.registerAggregator(
                    mockUsdv.address,
                    USDVAggregator.address
                ),
                "TwapOracle::registerAggregator: aggregator already exists"
            );
        });
    });

    describe.only("consult", () => {
        it("should consult for vader", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const {
                twap,
                dai,
                mockUsdv,
                poolV2,
                routerV2,
                token,
                mockUniswapV2Factory,
                lpWrapper,
                synthFactory,
                mockUniswapV2Router,
            } = await deployMock(accounts);

            await poolV2.initialize(
                lpWrapper.address,
                synthFactory.address,
                routerV2.address
            );

            // Set the supported tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(mockUsdv.address, true);
            await poolV2.setTokenSupport(token.address, true);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Amount to mint approve
            const accountsAmount = parseUnits(1000000, 18);

            // Mint and approve all tokens for the router
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                dai,
                accountsAmount
            );
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                mockUsdv,
                accountsAmount
            );
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                token,
                accountsAmount
            );

            // Approve the pool also
            await mockUsdv.approve(poolV2.address, accountsAmount);
            await dai.approve(poolV2.address, accountsAmount);
            await token.approve(poolV2.address, accountsAmount);

            const liquidity = parseUnits(10000, 18);

            // Add liquidity
            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            // Add liquidity
            await routerV2.addLiquidity(
                mockUsdv.address,
                token.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            const amountIn = parseUnits(1000, 18);

            // We dont care about output here
            const amountOutMin = parseUnits(10, 18);

            // // Swaps
            // await routerV2.swapExactTokensForTokens(
            //     amountIn,
            //     amountOutMin,
            //     [mockUsdv.address, dai.address],
            //     accounts.account2,
            //     deadline
            // );
            //
            // await routerV2.swapExactTokensForTokens(
            //     amountIn,
            //     amountOutMin,
            //     [mockUsdv.address, dai.address],
            //     accounts.account2,
            //     deadline
            // );
            //
            // await routerV2.swapExactTokensForTokens(
            //     amountIn,
            //     amountOutMin,
            //     [mockUsdv.address, token.address],
            //     accounts.account2,
            //     deadline
            // );

            // Initialize the twap
            await twap.initialize(mockUsdv.address, token.address);

            await twap.enableUSDV();

            // Register the pair
            await twap.registerPair(
                UNSET_ADDRESS,
                mockUsdv.address,
                dai.address
            );
            await twap.registerPair(
                UNSET_ADDRESS,
                mockUsdv.address,
                token.address
            );

            // // Debug
            // const uniswapPairAddress = await mockUniswapV2Factory.getPair(
            //     token.address,
            //     mockUsdv.address
            // );
            // const uniswapPair = await UniswapV2Pair.at(uniswapPairAddress);

            // // Approvals
            // await token.approve(
            //     mockUniswapV2Factory.address,
            //     parseUnits(1000000, 18)
            // );
            // await token.approve(uniswapPair.address, parseUnits(1000000, 18));

            // await mockUsdv.approve(
            //     mockUniswapV2Factory.address,
            //     parseUnits(1000000, 18)
            // );
            // await mockUsdv.approve(
            //     uniswapPair.address,
            //     parseUnits(1000000, 18)
            // );

            await token.approve(
                mockUniswapV2Router.address,
                parseUnits(10000000, 18)
            );

            await mockUsdv.approve(
                mockUniswapV2Router.address,
                parseUnits(10000000, 18)
            );

            const amountUniDesired = parseUnits(100, 18);
            const amountUniMin = parseUnits(10, 18);

            // Add liquidity to uniswap
            await mockUniswapV2Router.addLiquidity(
                token.address,
                mockUsdv.address,
                amountUniDesired,
                amountUniDesired,
                amountUniMin,
                amountUniMin,
                accounts.account0,
                deadline
            );

            // Register the pair
            await twap.registerPair(
                mockUniswapV2Factory.address,
                token.address,
                mockUsdv.address
            );

            // Create mock aggregators
            const UsdvAggregator = await MockAggregatorV3.new(mockUsdv.address);
            const VaderAggregator = await MockAggregatorV3.new(token.address);

            // Register the mock aggregators
            await twap.registerAggregator(
                mockUsdv.address,
                UsdvAggregator.address
            );
            await twap.registerAggregator(
                token.address,
                VaderAggregator.address
            );

            await advanceBlock();

            await advanceBlock();

            // Update needs to be called at least one time
            await twap.update();

            // Get consult for the usdv
            console.log(
                "Consult USDV  : ",
                (await twap.consult(mockUsdv.address)).toString()
            );

            console.log(
                "Consult Vader  : ",
                (await twap.consult(token.address)).toString()
            );
            console.log("Get rate : ", (await twap.getRate()).toString());
        });
    });

    describe("register pair", () => {
        it("should not allow to register pair with a non owner account", async () => {
            const { twap, dai, mockUsdv } = await deployMock();

            await assertErrors(
                twap.registerPair(
                    UNSET_ADDRESS,
                    dai.address,
                    mockUsdv.address,
                    {
                        from: accounts.account1,
                    }
                ),
                "Ownable: caller is not the owner"
            );
        });

        it("should not allow to register pair with a invalid token A", async () => {
            const { twap, dai, mockUsdv } = await deployMock();

            await assertErrors(
                twap.registerPair(UNSET_ADDRESS, dai.address, mockUsdv.address),
                "TwapOracle::registerPair: Invalid token0 address"
            );
        });

        it("should not allow to register pair with a same token A and B", async () => {
            const { twap, mockUsdv } = await deployMock();

            await assertErrors(
                twap.registerPair(
                    UNSET_ADDRESS,
                    mockUsdv.address,
                    mockUsdv.address
                ),
                "TwapOracle::registerPair: Same token address"
            );
        });

        it("should not allow to register pair if pair already exists", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { twap, dai, mockUsdv, vader, factory, poolV2, routerV2 } =
                await deployMock(accounts);

            const mockAccount = accounts.account5;
            await poolV2.initialize(mockAccount, mockAccount, routerV2.address);

            // Set the supported tokens
            await poolV2.setTokenSupport(dai.address, true);
            await poolV2.setTokenSupport(mockUsdv.address, true);

            // Construct the deadline
            const latestBlock = await web3.eth.getBlock("latest");
            const deadline = latestBlock.timestamp + 1000;

            // Amount to mint approve
            const accountsAmount = parseUnits(1000000, 18);

            // Mint and approve all tokens for the router
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                dai,
                accountsAmount
            );
            mintAndApprove(
                accounts.account0,
                routerV2.address,
                mockUsdv,
                accountsAmount
            );

            // Approve the pool also
            await mockUsdv.approve(poolV2.address, accountsAmount);
            await dai.approve(poolV2.address, accountsAmount);

            const liquidity = parseUnits(10000, 18);

            // Add liquidity
            await routerV2.addLiquidity(
                mockUsdv.address,
                dai.address,
                liquidity,
                liquidity,
                accounts.account0,
                deadline
            );

            const amountIn = parseUnits(1000, 18);

            // We dont care about output here
            const amountOutMin = parseUnits(10, 18);

            // Swap Dai
            await routerV2.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                [mockUsdv.address, dai.address],
                accounts.account2,
                deadline
            );

            await twap.initialize(mockUsdv.address, vader.address);
            await twap.registerPair(
                factory.address,
                mockUsdv.address,
                dai.address
            );

            await assertErrors(
                twap.registerPair(UNSET_ADDRESS, mockUsdv.address, dai.address),
                "TwapOracle::registerPair: Pair exists"
            );
        });

        it("should not allow to register pair if no reserves", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { twap, dai, mockUsdv, vader } = await deployMock(accounts);

            await twap.initialize(mockUsdv.address, vader.address);

            await assertErrors(
                twap.registerPair(UNSET_ADDRESS, mockUsdv.address, dai.address),
                "TwapOracle::registerPair: No reserves"
            );
        });
    });

    describe("update", () => {
        it("should not allow to update from a non owner account", async () => {
            if (Array.isArray(accounts))
                accounts = await verboseAccounts(accounts);
            const { twap } = await deployMock(accounts);

            await assertErrors(
                twap.update({ from: accounts.account1 }),
                "Ownable: caller is not the owner"
            );
        });
    });
});
