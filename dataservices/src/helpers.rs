use std::sync::OnceLock;
use scylla::value::CqlTimeuuid;
use mac_address::get_mac_address;

use crate::protos::plib::PUuid;

static NODE_ID: OnceLock<[u8; 6]> = OnceLock::new();

impl From<uuid::Uuid> for PUuid {
    fn from(uuid: uuid::Uuid) -> Self {
        let (id_high, id_low) = uuid.as_u64_pair();
        PUuid {
            id_high,
            id_low
        }
    }
}

impl From<PUuid> for uuid::Uuid {
    fn from(puuid: PUuid) -> Self {
        uuid::Uuid::from_u64_pair(puuid.id_high, puuid.id_low)
    }
}

impl From<PUuid> for CqlTimeuuid {
    fn from(puuid: PUuid) -> Self {
        let uuid: uuid::Uuid = puuid.into();
        CqlTimeuuid::from(uuid)
    }
}

impl From<CqlTimeuuid> for PUuid {
    fn from(cql_timeuuid: CqlTimeuuid) -> Self {
        let uuid: uuid::Uuid = cql_timeuuid.into();
        uuid.into()
    }
}

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