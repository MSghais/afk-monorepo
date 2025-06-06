mod ico_tests {
    use alexandria_math::fast_power::fast_power;
    use core::num::traits::Zero;
    use snforge_std::{
        CheatSpan, ContractClassTrait, DeclareResultTrait, EventSpyAssertionsTrait, EventSpyTrait,
        cheat_block_timestamp, cheat_caller_address, declare, spy_events,
    };
    use starknet::{ClassHash, ContractAddress};
    use crate::interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::interfaces::ico::{
        ContractConfig, IICOConfigDispatcher, IICOConfigDispatcherTrait, IICODispatcher,
        IICODispatcherTrait, PresaleDetails, PresaleFinalized, PresaleLaunched, TokenBought,
        TokenCreated, TokenDetails,
    };
    use crate::launchpad::ico::ICO;

    const EKUBO_EXCHANGE: ContractAddress =
        0x00000005dd3d2f4429af886cd1a3b08289dbcea99a294197e9eb43b0e0325b4b
        .try_into()
        .unwrap();

    const OWNER: ContractAddress = 'OWNER'.try_into().unwrap();
    const ADMIN: ContractAddress = 'ADMIN'.try_into().unwrap();
    const PROTOCOL: ContractAddress = 'PROTOCOL'.try_into().unwrap();
    const USER: ContractAddress = 'USER'.try_into().unwrap();
    const BUYER: ContractAddress = 'BUYER'.try_into().unwrap();

    fn get_max_supply() -> u256 {
        1_000_000 * fast_power(10, 18)
    }

    fn deploy(
        token_class_hash: ClassHash,
        fee_amount: u256,
        fee_to: ContractAddress,
        max_token_supply: u256,
        paid_in: ContractAddress,
        exchange_address: ContractAddress,
    ) -> ContractAddress {
        let owner = ADMIN;
        let mut calldata = array![];

        (owner, token_class_hash, fee_amount, fee_to, max_token_supply, paid_in, exchange_address)
            .serialize(ref calldata);
        let contract = declare("ICO").unwrap().contract_class();
        let (address, _) = contract.deploy(@calldata).unwrap();
        address
    }

    fn deploy_default() -> ContractAddress {
        let token_class_hash = *declare("ERC20").unwrap().contract_class().class_hash;
        let fee_amount: u256 = 0;
        let fee_to = PROTOCOL;
        let max_token_supply = get_max_supply();
        let paid_in = deploy_erc20(OWNER);
        let exchange_address = EKUBO_EXCHANGE;

        deploy(token_class_hash, fee_amount, fee_to, max_token_supply, paid_in, exchange_address)
    }

    /// For base coin -- buy token
    fn deploy_erc20(owner: ContractAddress) -> ContractAddress {
        let mut calldata = array![];
        ('USD COIN', 'USDC', 1_000_000_u256 * fast_power(10, 18), owner, 18_u8)
            .serialize(ref calldata);
        let contract = declare("ERC20").unwrap().contract_class();
        let (contract_address, _) = contract.deploy(@calldata).unwrap();
        contract_address
    }

    fn get_default_token_details() -> TokenDetails {
        TokenDetails {
            name: 'My Token',
            symbol: 'MYTK',
            initial_supply: get_max_supply(),
            decimals: 18,
            salt: 0,
        }
    }

    fn launch_presale(
        token_address: ContractAddress,
        details: PresaleDetails,
        dispatcher: IICODispatcher,
        owner: ContractAddress,
    ) {
        let contract = dispatcher.contract_address;
        cheat_caller_address(contract, owner, CheatSpan::TargetCalls(1));
        dispatcher.launch_presale(token_address, Option::Some(details));
    }

    fn init_presale_details(buy_token: ContractAddress, whitelist: bool) -> PresaleDetails {
        let presale_rate = 100; // 100 tokens to 1 of base (buy_token)
        let hard_cap = 1500 * fast_power(10, 18);
        let soft_cap = 70 * hard_cap / 100; // 1050 * fast_power(10, 18);
        let liquidity_percentage = 60;
        let listing_rate = 60;
        let start_time = 0;
        let end_time = 10;
        let liquidity_lockup = 100;

        // let min_supply = 20 * details.presale_rate * details.hard_cap / 100;
        PresaleDetails {
            buy_token,
            presale_rate,
            whitelist,
            soft_cap,
            hard_cap,
            liquidity_percentage,
            listing_rate,
            start_time,
            end_time,
            liquidity_lockup,
        }
    }

    fn config(buy_token: ContractAddress, contract: ContractAddress) {
        let config = ContractConfig {
            exchange_address: Option::None,
            accepted_buy_tokens: array![buy_token],
            fee: Option::None,
            max_token_supply: Option::None,
            paid_in: Option::None,
            token_class_hash: Option::None,
            unrug_address: Option::None,
        };
        cheat_caller_address(contract, ADMIN, CheatSpan::TargetCalls(1));
        let config_dispatcher = IICOConfigDispatcher { contract_address: contract };
        config_dispatcher.set_config(config);
    }

    fn context(
        whitelist: bool,
    ) -> (IICODispatcher, IERC20Dispatcher, IERC20Dispatcher, PresaleDetails) {
        let contract_address = deploy_default();
        let dispatcher = IICODispatcher { contract_address };
        let buy_token = deploy_erc20(OWNER);
        cheat_caller_address(contract_address, USER, CheatSpan::TargetCalls(1));
        let token = dispatcher.create_token(get_default_token_details());
        config(buy_token, contract_address);

        cheat_caller_address(token, USER, CheatSpan::TargetCalls(3));
        let token_dispatcher = IERC20Dispatcher { contract_address: token };
        let user_balance = token_dispatcher.balance_of(USER);
        token_dispatcher.approve(contract_address, user_balance);

        let details = init_presale_details(buy_token, whitelist);
        assert(token_dispatcher.balance_of(contract_address) == 0, 'INVALID INIT BALANCE');
        launch_presale(token, details, dispatcher, USER);

        let buy_token_dispatcher = IERC20Dispatcher { contract_address: buy_token };
        (dispatcher, token_dispatcher, buy_token_dispatcher, details)
    }

    fn buy_presale(
        ref buyers: Array<ContractAddress>,
        ico: IICODispatcher,
        token: IERC20Dispatcher,
        buy_token: IERC20Dispatcher,
    ) {
        for i in 0..buyers.len() {
            let buyer = *buyers.at(i);
            let amount = buy_token.balance_of(buyer);
            cheat_caller_address(buy_token.contract_address, buyer, CheatSpan::TargetCalls(1));
            buy_token.approve(ico.contract_address, amount);
            cheat_caller_address(ico.contract_address, buyer, CheatSpan::TargetCalls(1));
            ico.buy_token(token.contract_address, amount);
        }
    }

    fn mint(
        ref targets: Array<ContractAddress>,
        token: IERC20Dispatcher,
        default: u256,
        additional: u256,
    ) {
        assert(targets.len() > 0, 'EMPTY TARGET');
        assert(
            token.balance_of(OWNER) > (default * targets.len().into() + additional),
            'BALANCE CHECK FAILED 5',
        );
        println!("OWNER BALANCE: {}", token.balance_of(OWNER));
        for i in 0..targets.len() {
            let target = *targets.at(i);
            cheat_caller_address(token.contract_address, OWNER, CheatSpan::TargetCalls(1));
            token.transfer(target, default);
            println!(
                "Transferred {} from OWNER to buyer{}. OWNER BALANCE: {}",
                default,
                i + 1,
                token.balance_of(OWNER),
            );
        }
        if additional > 0 {
            let final = *targets.at(targets.len() - 1);
            cheat_caller_address(token.contract_address, OWNER, CheatSpan::TargetCalls(1));
            token.transfer(final, additional);
        }
        assert(token.balance_of(*targets.at(0)) > 0, 'INVALID BALANCE 66');
    }

    fn claim(buyers: Array<ContractAddress>, ico: IICODispatcher, token: IERC20Dispatcher) {
        for i in 0..buyers.len() {
            let buyer = *buyers.at(i);
            cheat_caller_address(ico.contract_address, buyer, CheatSpan::TargetCalls(1));
            ico.claim(token.contract_address);
            assert(token.balance_of(buyer) > 0, 'CLAIM FAILED');
        }
    }

    fn default_buyers() -> Array<ContractAddress> {
        let buyer1: ContractAddress = 'BUYER1'.try_into().unwrap();
        let buyer2: ContractAddress = 'BUYER2'.try_into().unwrap();
        let buyer3: ContractAddress = 'BUYER3'.try_into().unwrap();
        array![buyer1, buyer2, buyer3]
    }

    fn feign_default_presale() -> (IICODispatcher, IERC20Dispatcher, IERC20Dispatcher) {
        let (ico, token, buy_token, _) = context(false);
        let mut buyer_ref = array![BUYER];
        let amount = 1000;
        mint(ref buyer_ref, buy_token, amount, 0);
        assert(buy_token.balance_of(BUYER) == amount, 'MINTING FAILED');
        buy_presale(ref buyer_ref, ico, token, buy_token);
        assert(buy_token.balance_of(BUYER) == 0, 'BUY FAILED');
        (ico, token, buy_token)
    }

    /// TESTS

    #[test]
    fn test_ico_deploy_erc20() {
        let contract_address = deploy_erc20(OWNER);
        let dispatcher = IERC20Dispatcher { contract_address };
        assert(dispatcher.name() == 'USD COIN', 'ERC20 NAME MISMATCH');
        assert(dispatcher.symbol() == 'USDC', 'ERC20 SYMBOL MISMATCH');
        assert(dispatcher.total_supply() == get_max_supply(), 'ERC20 SUPPLY MISMATCH');
        assert(dispatcher.decimals() == 18_u8, 'ERC20 DECIMALS MISMATCH');
        assert(dispatcher.balance_of(OWNER) == get_max_supply(), 'ERC20 OWNER MISMATCH');
    }

    #[test]
    fn test_ico_create_token() {
        let contract_address = deploy_default();
        let dispatcher = IICODispatcher { contract_address };

        let mut spy = spy_events();
        cheat_caller_address(contract_address, USER, CheatSpan::TargetCalls(1));
        cheat_block_timestamp(contract_address, 4, CheatSpan::TargetCalls(1));
        let token_address = dispatcher.create_token(get_default_token_details());
        assert(token_address.is_non_zero(), 'TOKEN ADDRESS IS ZERO');

        let token_dispatcher = IERC20Dispatcher { contract_address: token_address };
        assert(token_dispatcher.balance_of(USER) == get_max_supply(), 'USER BALANCE MISMATCH');
        assert(token_dispatcher.name() == 'My Token', 'CREATE TOKEN NAME MISMATCH');
        assert(token_dispatcher.symbol() == 'MYTK', 'CREATE TOKEN SYMBOL MISMATCH');
        assert(token_dispatcher.decimals() == 18, 'TOTAL SUPPLY MISMATCH');

        let expected_event = ICO::Event::TokenCreated(
            TokenCreated {
                token_address,
                owner: USER,
                name: 'My Token',
                symbol: 'MYTK',
                decimals: 18,
                initial_supply: get_max_supply(),
                created_at: 4,
            },
        );

        spy.assert_emitted(@array![(contract_address, expected_event)]);
    }

    #[test]
    #[should_panic(expected: 'ZERO CALLER')]
    fn test_ico_create_token_zero_address() {
        let contract_address = deploy_default();
        let dispatcher = IICODispatcher { contract_address };

        cheat_caller_address(contract_address, Zero::zero(), CheatSpan::TargetCalls(1));
        dispatcher.create_token(get_default_token_details());
    }

    #[test]
    fn test_ico_launch_presale_with_created_token() {
        let mut spy = spy_events();
        let (ico, token, _, details) = context(false);
        assert(token.balance_of(ico.contract_address) > 0, 'INVALID CONTRACT BALANCE');

        let expected_event = ICO::Event::PresaleLaunched(
            PresaleLaunched {
                buy_token: details.buy_token,
                presale_rate: details.presale_rate,
                soft_cap: details.soft_cap,
                hard_cap: details.hard_cap,
                liquidity_percentage: details.liquidity_percentage,
                listing_rate: details.listing_rate,
                start_time: details.start_time,
                end_time: details.end_time,
                liquidity_lockup: details.liquidity_lockup,
            },
        );

        spy.assert_emitted(@array![(ico.contract_address, expected_event)]);
    }

    #[test]
    #[should_panic(expected: 'BUY TOKEN NOT SUPPORTED')]
    fn test_ico_launch_presale_invalid_buy_token() {
        let contract_address = deploy_default();
        let dispatcher = IICODispatcher { contract_address };
        let buy_token = deploy_erc20(OWNER);
        cheat_caller_address(contract_address, USER, CheatSpan::TargetCalls(1));
        let token = dispatcher.create_token(get_default_token_details());

        let details = init_presale_details(buy_token, false);
        launch_presale(token, details, dispatcher, USER);
    }

    #[test]
    fn test_ico_launch_presale_with_existing_token() {
        let contract_address = deploy_default();
        let dispatcher = IICODispatcher { contract_address };
        let token = deploy_erc20(OWNER);
        let buy_token = deploy_erc20(OWNER);
        config(buy_token, contract_address);

        cheat_caller_address(token, OWNER, CheatSpan::TargetCalls(3));
        let token_dispatcher = IERC20Dispatcher { contract_address: token };
        let user_balance = token_dispatcher.balance_of(OWNER);
        token_dispatcher.approve(contract_address, user_balance);

        let details = init_presale_details(buy_token, false);
        assert(token_dispatcher.balance_of(contract_address) == 0, 'INVALID INIT BALANCE');
        launch_presale(token, details, dispatcher, OWNER);
        assert(token_dispatcher.balance_of(contract_address) > 0, 'INVALID CONTRACT BALANCE');
    }

    #[test]
    #[should_panic(expected: 'VERIFICATION FAILED')]
    fn test_ico_launch_presale_should_panic_on_token_ownership_non_owner() {
        let contract_address = deploy_default();
        let dispatcher = IICODispatcher { contract_address };
        let buy_token = deploy_erc20(OWNER);
        cheat_caller_address(contract_address, USER, CheatSpan::TargetCalls(1));
        let token = dispatcher.create_token(get_default_token_details());
        config(buy_token, contract_address);

        let token_dispatcher = IERC20Dispatcher { contract_address: token };
        let user_balance = token_dispatcher.balance_of(OWNER);
        cheat_caller_address(token, OWNER, CheatSpan::TargetCalls(1));
        token_dispatcher.approve(contract_address, user_balance);

        let details = init_presale_details(buy_token, false);
        launch_presale(token, details, dispatcher, OWNER);
    }

    #[test]
    #[should_panic(expected: 'VERIFICATION FAILED')]
    fn test_ico_launch_presale_should_panic_on_token_ownership_unverified_owner() {
        let contract_address = deploy_default();
        let dispatcher = IICODispatcher { contract_address };
        let buy_token = deploy_erc20(OWNER);
        let token = deploy_erc20(USER);
        let token_dispatcher = IERC20Dispatcher { contract_address: token };
        config(buy_token, contract_address);

        // the presale launcher is the user, but invalidate ownership
        // send 20 percent of the total supply to another user
        let balance = token_dispatcher.balance_of(USER);
        println!("Balance of user: {}", balance);
        let amount = 20 * balance / 100;
        cheat_caller_address(token, USER, CheatSpan::TargetCalls(3));
        token_dispatcher.transfer(PROTOCOL, amount);

        let user_balance = token_dispatcher.balance_of(USER);
        token_dispatcher.approve(contract_address, user_balance);

        let details = init_presale_details(buy_token, false);
        launch_presale(token, details, dispatcher, USER);
    }

    #[test]
    #[should_panic(expected: 'PRESALE ALREADY LAUNCHED')]
    fn test_ico_launch_presale_with_already_launched_token() {
        let (ico, token, _, details) = context(false);
        launch_presale(token.contract_address, details, ico, OWNER);
    }

    #[test]
    #[should_panic(expected: 'CALLER NOT WHITELISTED')]
    fn test_ico_buy_token_should_panic_on_caller_not_whitelisted() {
        let (ico, token, buy_token, details) = context(true);
        // the creator is USER
        let target: ContractAddress = 'TARGET'.try_into().unwrap();
        cheat_caller_address(buy_token.contract_address, OWNER, CheatSpan::TargetCalls(1));
        let amount = 10000;
        buy_token.transfer(target, amount);

        cheat_caller_address(ico.contract_address, USER, CheatSpan::TargetCalls(1));
        ico.whitelist(token.contract_address, array![target]);
        // target should be able to buy a token successfully
        cheat_caller_address(buy_token.contract_address, target, CheatSpan::TargetCalls(1));
        buy_token.approve(ico.contract_address, amount);
        let mut spy = spy_events();

        assert(buy_token.balance_of(target) == amount, 'INVALID BALANCE');

        cheat_caller_address(ico.contract_address, target, CheatSpan::TargetCalls(1));
        cheat_block_timestamp(ico.contract_address, 1, CheatSpan::TargetCalls(1));
        ico.buy_token(token.contract_address, amount);

        let token_amount = details.presale_rate * amount;
        let expected_event = ICO::Event::TokenBought(
            TokenBought {
                token_address: token.contract_address,
                amount: token_amount,
                buyer: target,
                bought_at: 1,
            },
        );

        spy.assert_emitted(@array![(ico.contract_address, expected_event)]);
        assert(buy_token.balance_of(ico.contract_address) == amount, 'TRANSFER FAILED');
        assert(token.balance_of(target) == 0, 'SHOULD BE ZERO');

        println!("Buy by Target successful.");
        cheat_caller_address(ico.contract_address, OWNER, CheatSpan::TargetCalls(1));
        ico.buy_token(token.contract_address, amount);
    }

    #[test]
    #[should_panic(expected: 'UNAUTHORIZED')]
    fn test_ico_whitelist_should_panic_on_caller_not_token_owner() {
        let (ico, token, _, _) = context(true);
        cheat_caller_address(ico.contract_address, OWNER, CheatSpan::TargetCalls(1));
        ico.whitelist(token.contract_address, array![PROTOCOL]);
    }

    #[test]
    #[should_panic(expected: 'PRESALE CONCLUDED OR INVALID')]
    fn test_ico_buy_token_should_panic_on_concluded_presale() {
        // here, the presale should resolve automatically
        let (ico, token, _, _) = context(false);
        let target: ContractAddress = 'TARGET'.try_into().unwrap();
        cheat_caller_address(ico.contract_address, target, CheatSpan::TargetCalls(1));
        let amount = 10000;

        // ends at 10, so set the bluck timestamp to 11
        cheat_block_timestamp(ico.contract_address, 11, CheatSpan::TargetCalls(1));
        ico.buy_token(token.contract_address, amount);
    }

    #[test]
    fn test_ico_claim_buy_token_on_failed_presale() {
        let (ico, token, buy_token, _) = context(false);
        let target: ContractAddress = 'TARGET'.try_into().unwrap();
        cheat_caller_address(buy_token.contract_address, OWNER, CheatSpan::TargetCalls(1));
        let amount = 10000;
        buy_token.transfer(target, amount);
        let mut targets = array![target];

        buy_presale(ref targets, ico, token, buy_token);
        // ends at 10, so set the block timestamp to 11
        cheat_block_timestamp(ico.contract_address, 11, CheatSpan::TargetCalls(2));
        let mut spy = spy_events();
        cheat_caller_address(ico.contract_address, target, CheatSpan::TargetCalls(1));
        ico.claim(token.contract_address);
        // Presale failed, so the token claimed shouldn't be the presale token, but
        // the token used in buying the presale.
        assert(buy_token.balance_of(target) == amount, 'INVALID BALANCE.');
        let expected_event = ICO::Event::PresaleFinalized(
            PresaleFinalized {
                presale_token_address: token.contract_address,
                buy_token_address: buy_token.contract_address,
                successful: false,
            },
        );
        spy.assert_emitted(@array![(ico.contract_address, expected_event)]);
    }

    #[test]
    fn test_ico_presale_token_success_hard_cap_test() {
        // This also tests the hardcap capping of buy token
        // when a buyer buys into a presale, and the amount exceeds the hardcap
        // only the require amount used for the buy transaction.
        let (ico, token, buy_token, details) = context(false);

        let amount = details.hard_cap / 3; // 500 * fast_power(10, 18)
        let cash_back = fast_power(10, 20); // 100 * fast_power(10, 18)
        let mut buyers = default_buyers();
        mint(ref buyers, buy_token, amount, cash_back);

        let mut spy = spy_events();
        buy_presale(ref buyers, ico, token, buy_token);
        let expected_event = ICO::Event::PresaleFinalized(
            PresaleFinalized {
                presale_token_address: token.contract_address,
                buy_token_address: buy_token.contract_address,
                successful: true,
            },
        );

        // there should a cash_back
        let buyer3 = *buyers.at(buyers.len() - 1);
        assert(buy_token.balance_of(buyer3) == cash_back, 'CASHBACK NOT RETURNED');
        assert(token.balance_of(buyer3) == 0, 'ERROR IN PRESALE');

        spy.assert_emitted(@array![(ico.contract_address, expected_event)]);
    }

    #[test]
    fn test_ico_presale_token_success_soft_cap_test() {
        // 1050 * fast_power(10, 18); soft cap.
        // any entry function that handles interaction with an already existing presale
        // can finalize the presale using `update_status()`
        let (ico, token, buy_token, details) = context(false);
        let amount = details.soft_cap / 3; // 350 * fast_power(10, 18)

        // 350 each for soft cap
        let mut buyers = default_buyers();
        mint(ref buyers, buy_token, amount, 0);

        buy_presale(ref buyers, ico, token, buy_token);
        cheat_block_timestamp(ico.contract_address, 11, CheatSpan::TargetCalls(1));
        cheat_caller_address(ico.contract_address, ADMIN, CheatSpan::TargetCalls(1));
        let successful = ico.is_successful(token.contract_address);
        assert(successful, 'PRESALE SOFT CAP ERROR');
    }

    #[test]
    #[should_panic(expected: 'PRESALE NOT CLAIMABLE')]
    fn test_ico_claim_should_panic_on_non_active_presale() {
        let (ico, token, _) = feign_default_presale();
        cheat_caller_address(ico.contract_address, BUYER, CheatSpan::TargetCalls(1));
        ico.claim(token.contract_address);
    }

    #[test]
    fn test_ico_cancel_buy_success() {
        let (ico, token, buy_token) = feign_default_presale();
        cheat_caller_address(ico.contract_address, BUYER, CheatSpan::TargetCalls(1));
        ico.cancel_buy(token.contract_address);
        assert(buy_token.balance_of(BUYER) == 1000, 'CANCEL BUY FAILED');
    }

    #[test]
    #[should_panic(expected: 'ACTION NOT ALLOWED')]
    fn test_ico_cancel_buy_should_panic_on_concluded_presale() {
        let (ico, token, _) = feign_default_presale();
        cheat_caller_address(ico.contract_address, BUYER, CheatSpan::TargetCalls(1));
        cheat_block_timestamp(ico.contract_address, 11, CheatSpan::TargetCalls(1));
        ico.cancel_buy(token.contract_address);
    }

    #[test]
    fn test_ico_claim_all_on_failed_presale() {
        let (ico, token, buy_token) = feign_default_presale();
        // buy again, total amount 1150
        let mut buyer_ref = array![BUYER];
        mint(ref buyer_ref, buy_token, 150, 0);
        cheat_caller_address(ico.contract_address, BUYER, CheatSpan::TargetCalls(5));
        buy_presale(ref buyer_ref, ico, token, buy_token);
        assert(buy_token.balance_of(BUYER) == 0, 'BALANCE SHOULD BE ZERO');
        cheat_block_timestamp(ico.contract_address, 11, CheatSpan::TargetCalls(1));
        cheat_caller_address(ico.contract_address, BUYER, CheatSpan::TargetCalls(5));
        ico.claim_all();
        assert(buy_token.balance_of(BUYER) == 1150, 'INVALID BALANCE');
    }

    #[test]
    #[should_panic(expected: 'LAUNCHING FAILED')]
    fn test_ico_launch_liquidity_should_finalize_and_panic_on_failed_presale() {
        let (ico, token, _) = feign_default_presale();
        cheat_block_timestamp(ico.contract_address, 11, CheatSpan::TargetCalls(5));
        cheat_caller_address(ico.contract_address, USER, CheatSpan::TargetCalls(2));
        ico.launch_liquidity(token.contract_address, Option::None);
        // rest assured, it'll panic with UNAUTHORIZED if caller is not owner
    }

    #[test]
    #[should_panic(expected: 'INVALID LAUNCH')]
    fn test_ico_launch_liquidity_should_panic_on_invalid_token_or_unlaunched_presale() {
        let unlaunched_token = deploy_erc20(OWNER);
        let contract_address = deploy_default();
        let ico = IICODispatcher { contract_address };
        cheat_caller_address(contract_address, OWNER, CheatSpan::TargetCalls(1));
        ico.launch_liquidity(unlaunched_token, Option::None);
    }

    #[test]
    #[ignore]
    fn test_ico_claim_all_after_two_presales() {
        // this test requires more than one presale to occur
        let (ico, token, buy_token, details) = context(false);

        let amount = details.hard_cap / 3; // 500 * fast_power(10, 18)
        let mut buyers = default_buyers(); // three buyers
        mint(ref buyers, buy_token, amount, 0);

        let mut spy = spy_events();
        buy_presale(ref buyers, ico, token, buy_token);
        // start another presale
    // here, all buyers have zero funds, in both the previous concluded presale token
    // and the token using in buying the presale
    // let details = init_presale_details();
    }

    #[test]
    fn test_ico_launch_liquidity_success() { // This will require the overhead of testing the same function tested in the
    // launchpad_tests.cairo
    }

    #[test]
    #[ignore]
    #[should_panic]
    fn test_ico_launch_presale_incorrect_presale_details() {}

    #[test]
    #[ignore]
    #[should_panic(expected: "CONFIG REQUIRES 20 PERCENT OF SUPPLY TO NOT BE SOLD")]
    fn test_ico_launch_presale_below_min_supply_threshold() {}

    #[test]
    fn test_ico_launch_presale_success_and_none_presale_details() {}
    // test_ico_presale_token_success_soft_cap_test -- again, maybe when launching liquidity
// Remember the storage mutable issh, with update status -- doesn't take in a ref of token.
// TODO: Don't forget to test this state.
// Test buy_token for a token twice, run claim_all, it shouldn't throw an error, but it should
// run perfectly.
// buy_token pushes the token's contract twice, so the second call to _claim should do
// absolutely nothing.
// But claim won't work until the token is deployed to Ekubo sepolia.

    /// transfer from owner to another user 80% of tokens, and try to launch a presale
///
///
/// TODO: TESTS ON CLAIM ON FAILED PRESALE...
///

}
