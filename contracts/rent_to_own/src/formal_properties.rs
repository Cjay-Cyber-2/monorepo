#![cfg(kani)]

use super::*;
use soroban_sdk::{Address, BytesN, Env, Symbol};

#[kani::proof]
pub fn verify_equity_accumulation_non_negative() {
    let current_equity: i128 = kani::any();
    let payment_amount: i128 = kani::any();
    kani::assume(current_equity >= 0);
    kani::assume(payment_amount >= 0);

    let result = current_equity.checked_add(payment_amount);
    if let Some(new_equity) = result {
        assert!(new_equity >= current_equity);
    }
}

#[kani::proof]
pub fn verify_default_settlement_bounds() {
    let equity_accumulated: i128 = kani::any();
    let forfeiture_bps: u32 = kani::any();
    kani::assume(equity_accumulated >= 0);
    kani::assume(forfeiture_bps <= 10000);

    let forfeited = (equity_accumulated * forfeiture_bps as i128) / 10000i128;
    let returned = equity_accumulated - forfeited;

    assert!(forfeited >= 0);
    assert!(returned >= 0);
    assert!(
        forfeited + returned == equity_accumulated
            || (equity_accumulated - forfeited - returned).abs() <= 1
    );
}
#[kani::proof]
pub fn verify_rent_to_own_lifecycle() {
    let env = Env::default();
    let contract_id = env.register(RentToOwn, ());
    let client = RentToOwnClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let tenant = Address::generate(&env);
    let deal_id = BytesN::from_array(&env, &[1u8; 32]);
    env.mock_all_auths();

    client.init(&admin, &2000u32);
    client.register_deal(&admin, &deal_id, &tenant, &100_000, &10_000, &1);

    let deal_before = client.get_deal(&deal_id).unwrap();
    assert_eq!(deal_before.payments_made, 0);

    client.record_equity_payment(&admin, &deal_id, &15_000, &10_000);

    let deal_after = client.get_deal(&deal_id).unwrap();
    assert_eq!(deal_after.payments_made, 1);
    assert_eq!(deal_after.equity_accumulated_usdc, 10_000);

    client.complete_deal(&admin, &deal_id);
    let deal_completed = client.get_deal(&deal_id).unwrap();
    assert!(matches!(deal_completed.status, DealStatus::Completed));
}
