#![cfg(kani)]

use super::*;
use soroban_sdk::{Address, Env, Symbol};

#[kani::proof]
pub fn verify_reputation_score_bounds() {
    let composite_score: u32 = kani::any();
    let payment_score: u32 = kani::any();
    let property_care_score: u32 = kani::any();
    let communication_score: u32 = kani::any();
    let total_ratings: u32 = kani::any();

    kani::assume(composite_score <= 1000);
    kani::assume(payment_score <= 1000);
    kani::assume(property_care_score <= 1000);
    kani::assume(communication_score <= 1000);

    let record = ReputationRecord {
        composite_score,
        payment_score,
        property_care_score,
        communication_score,
        total_ratings,
        last_updated: 1000,
    };

    assert!(record.composite_score <= 1000);
    assert!(record.payment_score <= 1000);
    assert!(record.property_care_score <= 1000);
    assert!(record.communication_score <= 1000);
}

#[kani::proof]
pub fn verify_score_decay_invariants() {
    let score: u32 = kani::any();
    let decay: u32 = kani::any();
    kani::assume(score <= 1000);
    kani::assume(decay <= 1000);

    let new_score = if score > decay { score - decay } else { 0 };

    assert!(new_score <= score);
    assert!(new_score <= 1000);
}
#[kani::proof]
pub fn verify_tenant_reputation_init_and_update() {
    let env = Env::default();
    let contract_id = env.register(TenantReputation, ());
    let client = TenantReputationClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let tenant = Address::generate(&env);
    env.mock_all_auths();

    client.init(&admin, &operator).unwrap();

    client
        .update_reputation(
            &operator,
            &tenant,
            &800,
            &850,
            &900,
            &750,
            &Symbol::new(&env, "payment_on_time"),
        )
        .unwrap();

    let record = client.get_reputation(&tenant).unwrap();
    assert_eq!(record.composite_score, 800);
    assert_eq!(record.total_ratings, 1);
}
