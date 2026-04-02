pub mod plib {
    tonic::include_proto!("plib");

    // impls
    use scylla::value::CqlTimeuuid;
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

    impl From<&PUuid> for uuid::Uuid {
        fn from(puuid: &PUuid) -> Self {
            uuid::Uuid::from_u64_pair(puuid.id_high, puuid.id_low)
        }
    }

    impl From<PUuid> for CqlTimeuuid {
        fn from(puuid: PUuid) -> Self {
            let uuid: uuid::Uuid = puuid.into();
            CqlTimeuuid::from(uuid)
        }
    }

    impl From<&PUuid> for CqlTimeuuid {
        fn from(value: &PUuid) -> Self {
            let uid: uuid::Uuid = value.into();
            CqlTimeuuid::from(uid)
        }
    }

    impl From<CqlTimeuuid> for PUuid {
        fn from(cql_timeuuid: CqlTimeuuid) -> Self {
            let uuid: uuid::Uuid = cql_timeuuid.into();
            uuid.into()
        }
    }
}

pub mod dataservices {
    pub mod user_service {
        tonic::include_proto!("dataservices.userproto");
    }

    pub mod channel_service {
        tonic::include_proto!("dataservices.channelproto");
    }

    pub mod message_service {
        tonic::include_proto!("dataservices.messageproto");
    }

    pub mod post_service {
        tonic::include_proto!("dataservices.postproto");
    }

    pub mod feed_service {
        tonic::include_proto!("dataservices.feedproto");
    }
}

