#![cfg(kani)]

use super::*;

#[kani::proof]
pub fn verify_instalment_remaining_non_negative() {
    let amount_due: i128 = kani::any();
    let amount_paid: i128 = kani::any();
    kani::assume(amount_due >= 0);
    kani::assume(amount_paid >= 0);
    kani::assume(amount_paid <= amount_due);

    let inst = ScheduledInstalment {
        instalment_number: 1,
        due_timestamp: 1000,
        amount_due,
        amount_paid,
        status: InstalmentStatus::Pending,
        paid_at: None,
        last_tx_id: None,
    };

    let rem = instalment_remaining(&inst);
    assert!(rem >= 0);
}

#[kani::proof]
pub fn verify_positive_payment_check() {
    let amount: i128 = kani::any();
    if amount <= 0 {
        let result = std::panic::catch_unwind(|| {
            assert_positive_payment(amount);
        });
        assert!(result.is_err());
    } else {
        let result = std::panic::catch_unwind(|| {
            assert_positive_payment(amount);
        });
        assert!(result.is_ok());
    }
}
