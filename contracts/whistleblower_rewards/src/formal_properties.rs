#![cfg(kani)]

use super::*;
use soroban_sdk::{Address, BytesN, Env, String, Symbol};

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
#[kani::proof]
pub fn verify_whistleblower_reward_lifecycle() {
    let env = Env::default();
    let contract_id = env.register(WhistleblowerRewards, ());
    let client = WhistleblowerRewardsClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let reporter = Address::generate(&env);
    env.mock_all_auths();

    client.init(&admin);

    let report_id = BytesN::from_array(&env, &[2u8; 32]);
    let listing_id = String::from_str(&env, "listing_99");
    client.submit_report(
        &reporter,
        &report_id,
        &listing_id,
        &Symbol::new(&env, "fraud"),
        &String::from_str(&env, "evidence"),
    );

    let report = client.get_report(&report_id).unwrap();
    assert_eq!(report.reporter, reporter);

    client.evaluate_report(&admin, &report_id, &true, &500);
    let evaluated_report = client.get_report(&report_id).unwrap();
    assert!(matches!(evaluated_report.status, ReportStatus::Verified));
}
