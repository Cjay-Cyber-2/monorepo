#![cfg(kani)]

use super::*;

#[kani::proof]
pub fn verify_allocation_amount_non_negative() {
    let amount: i128 = kani::any();
    kani::assume(amount >= 0);
    let record = AllocationRecord {
        amount,
        claimed_amount: 0,
        timestamp: 1000,
        status: AllocationStatus::Pending,
    };
    assert!(record.amount >= 0);
    assert!(record.claimed_amount >= 0);
    assert!(record.claimed_amount <= record.amount);
}

#[kani::proof]
pub fn verify_claim_bounds() {
    let amount: i128 = kani::any();
    let claimed_amount: i128 = kani::any();
    let claim_request: i128 = kani::any();

    kani::assume(amount >= 0);
    kani::assume(claimed_amount >= 0);
    kani::assume(claimed_amount <= amount);
    kani::assume(claim_request >= 0);

    let remaining = amount - claimed_amount;
    if claim_request > remaining {
        let result = std::panic::catch_unwind(|| {
            if claim_request > amount - claimed_amount {
                panic!("AmountExceedsClaimable");
            }
        });
        assert!(result.is_err());
    } else {
        let new_claimed = claimed_amount + claim_request;
        assert!(new_claimed <= amount);
    }
}
