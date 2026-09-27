use super::*;
use soroban_sdk::{Address, Env};

#[test]
fn test_unauthorized_access_event_emitted() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::from_string(&soroban_sdk::String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let unauthorized = Address::from_string(&soroban_sdk::String::from_str(
        &env,
        "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBX",
    ));

    let res = access_control::require_admin_permission(&env, &admin, &unauthorized, "pause");
    assert!(res.is_err());

    let events = env.events().all();
    assert!(!events.is_empty());
}
