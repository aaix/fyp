use crate::protos::plib::PUuid;

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

impl From<PUuid> for scylla::value::CqlTimeuuid {
    fn from(puuid: PUuid) -> Self {
        let uuid: uuid::Uuid = puuid.into();
        scylla::value::CqlTimeuuid::from(uuid)
    }
}

impl From<scylla::value::CqlTimeuuid> for PUuid {
    fn from(cql_timeuuid: scylla::value::CqlTimeuuid) -> Self {
        let uuid: uuid::Uuid = cql_timeuuid.into();
        uuid.into()
    }
}

pub fn gen_timeuuid() -> scylla::value::CqlTimeuuid {
    scylla::value::CqlTimeuuid::from(uuid::Uuid::new_v4())
}

pub fn gen_uuid() -> uuid::Uuid {
    uuid::Uuid::new_v4()
}