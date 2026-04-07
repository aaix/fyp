pub mod plib {
    tonic::include_proto!("plib");

    use std::hash::Hash;

    use scylla::{deserialize::value::DeserializeValue, serialize::value::SerializeValue, value::CqlTimeuuid};


    #[repr(align(8))]
    #[derive(Debug, Clone, Copy, Eq)]
    pub struct AllignedCqlTimeuuid(pub CqlTimeuuid);

    impl<'frame, 'metadata> DeserializeValue<'frame, 'metadata> for AllignedCqlTimeuuid {
        fn type_check(typ: &scylla::cluster::metadata::ColumnType) -> Result<(), scylla::errors::TypeCheckError> {
            CqlTimeuuid::type_check(typ)
        }
    
        fn deserialize(
            typ: &'metadata scylla::cluster::metadata::ColumnType<'metadata>,
            v: Option<scylla::deserialize::FrameSlice<'frame>>,
        ) -> Result<Self, scylla::errors::DeserializationError> {
            CqlTimeuuid::deserialize(typ, v).map(|v| {Self(v)})
        }
    }

    impl SerializeValue for AllignedCqlTimeuuid {
        fn serialize<'b>(
            &self,
            typ: &scylla::cluster::metadata::ColumnType,
            writer: scylla::serialize::writers::CellWriter<'b>,
        ) -> Result<scylla::serialize::writers::WrittenCellProof<'b>, scylla::errors::SerializationError> {
            self.0.serialize(typ, writer)
        }
    }

    impl Ord for AllignedCqlTimeuuid {
        fn cmp(&self, other: &Self) -> std::cmp::Ordering {
            self.0.cmp(&other.0)
        }
    }

    impl PartialOrd for AllignedCqlTimeuuid {
        fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
            self.0.partial_cmp(&other.0)
        }
    }

    impl PartialEq for AllignedCqlTimeuuid {
        fn eq(&self, other: &Self) -> bool {
            self.0.eq(&other.0)
        }
    }

    impl Hash for AllignedCqlTimeuuid {
        fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
            self.0.hash(state);
        }
    }

    impl From<AllignedCqlTimeuuid> for uuid::Uuid {
        fn from(value: AllignedCqlTimeuuid) -> Self {
            value.0.into()
        }
    }

    impl From<uuid::Uuid> for AllignedCqlTimeuuid {
        fn from(value: uuid::Uuid) -> Self {
            Self(CqlTimeuuid::from(value))
        }
    }


    // impls
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

    impl From<PUuid> for AllignedCqlTimeuuid {
        fn from(puuid: PUuid) -> Self {
            let uuid: uuid::Uuid = puuid.into();
            AllignedCqlTimeuuid(CqlTimeuuid::from(uuid))
        }
    }

    impl From<&PUuid> for AllignedCqlTimeuuid {
        fn from(value: &PUuid) -> Self {
            let uid: uuid::Uuid = value.into();
            AllignedCqlTimeuuid(CqlTimeuuid::from(uid))
        }
    }

    impl From<AllignedCqlTimeuuid> for PUuid {
        fn from(cql_timeuuid: AllignedCqlTimeuuid) -> Self {
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

