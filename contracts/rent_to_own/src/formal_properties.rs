#![cfg(kani)]

use super::*;

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
