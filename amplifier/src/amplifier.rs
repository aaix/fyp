use std::{net::{IpAddr}, str::FromStr};

use futures::future::join_all;
use prost::Message;
use tokio::net::UdpSocket;
use tonic::{Response, Status, async_trait};

use crate::protos::{
    amplifier::amplify::{amplifier_service_server::{AmplifierService, AmplifierServiceServer}, fan_out_request::*, *},
    intraservice::amplifiedmessage::AmplifiedIntraMessage
};

const SEND_PORT: u16 = 3117;
const PUUID_SIZE: usize = 24;
const MAX_MESSAGE_SIZE: usize = 1472;


pub struct AmplifierServiceRS {
    socket: UdpSocket
}

impl AmplifierServiceRS {
    
    pub async fn server() -> AmplifierServiceServer<Self> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating AmplifierService server: {:?}", e);
        } 
        AmplifierServiceServer::new(server.unwrap())
        
    }

    pub async fn new() -> Result<AmplifierServiceRS, Box<dyn std::error::Error>> {

        // TODO: use many sockets
        let socket = UdpSocket::bind("0.0.0.0:0").await.unwrap();

        Ok(Self {
            socket
        })
    }
}

impl AmplifierServiceRS {

    async fn send_to(&self, host: IpAddr, message: AmplifiedIntraMessage) {

        let data = message.encode_to_vec();

        match self.socket.send_to(&data, (host, SEND_PORT)).await {
            Err(e) => {
                tracing::error!("{e:?}");
            },
            Ok(written) => {
                tracing::debug!("wrote {written} bytes");
            }
        }
    }
}

#[async_trait]
impl AmplifierService for AmplifierServiceRS {

    async fn fan_out(
        &self,
        request: tonic::Request<FanOutRequest>,
    ) -> Result<tonic::Response<FanOutResponse>, tonic::Status> {

        let owned = request.into_inner();



        match owned.request_type.ok_or(Status::invalid_argument("Unexpected unpopulated request type"))? {
            RequestType::Many(many) => {
                // TODO
                return Err(Status::unimplemented("Many fan out not yet implemented, use legacy fan out"))
            }
            RequestType::Single(single) => {
                let data = single.payload;

                let message_size = data.len() + 4 + 1;

                let recipients_per_chunk = (MAX_MESSAGE_SIZE - message_size) / PUUID_SIZE;


                let futures = single.recipients.into_iter().map(async |r| {

                    // chunk recipients to stay under max UDP message size
                    let host = match IpAddr::from_str(&r.host) {
                        Ok(a) => a,
                        Err(e) => {
                            tracing::error!("Failed to parse host addr {e:?}");
                            return
                        }
                    };

                    // dont try and send concurrently to the same host
                    for recipients in r.recipients.chunks(recipients_per_chunk) {
                        let message = AmplifiedIntraMessage {
                            intramessage: data.clone(),
                            recipients: recipients.into()
                        };

                        self.send_to(host, message).await;
                    }

                });

                join_all(futures).await;
                
            }
        }


    
        Ok(Response::new(FanOutResponse {  }))

    }
}

