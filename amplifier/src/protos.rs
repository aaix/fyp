pub mod plib {
    tonic::include_proto!("plib");
}

pub mod amplifier {
    pub mod amplify {
        tonic::include_proto!("amplifier.amplify");
    }
}

pub mod intraservice {
    pub mod amplifiedmessage {
        tonic::include_proto!("intraservice.amplifiedmessage");
    }
}
pub mod traceparent {
    tonic::include_proto!("traceparent");
}