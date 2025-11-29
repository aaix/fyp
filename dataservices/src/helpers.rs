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

