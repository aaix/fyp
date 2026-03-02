use std::{sync::OnceLock, time::{SystemTime, UNIX_EPOCH}};
use scylla::value::{CqlTimestamp, CqlTimeuuid};
use mac_address::get_mac_address;


static NODE_ID: OnceLock<[u8; 6]> = OnceLock::new();


pub fn gen_timeuuid() -> CqlTimeuuid {
    let node_id= *NODE_ID.get_or_init(|| {
        let mac = get_mac_address().unwrap().unwrap();
        println!("MAC address: {:02x?}", mac.bytes());
        mac.bytes()
    });
    CqlTimeuuid::from(uuid::Uuid::now_v1(&node_id))
}

pub fn gen_uuid() -> uuid::Uuid {
    uuid::Uuid::new_v4()
}

pub fn time_now() -> CqlTimestamp {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    return CqlTimestamp(now.as_millis() as i64);
}