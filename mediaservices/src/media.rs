use tonic::async_trait;

use crate::protos::mediaservices::transformer::{TransformImageRequest, TransformImageResponse, TransformVideoRequest, TransformVideoResponse, transformer_service_server::{TransformerService, TransformerServiceServer}};

pub struct TransformerServer {

}
impl TransformerServer {
    pub fn server() -> TransformerServiceServer<Self> {

        let server = TransformerServiceServer::new(Self {});

        server
    }
}

#[async_trait]
impl TransformerService for TransformerServer {
    async fn transform_image(
        &self,
        request: tonic::Request<TransformImageRequest>,
    ) -> std::result::Result<
        tonic::Response<TransformImageResponse>,
        tonic::Status,
    > {
        todo!();
    }
    async fn transform_video(
        &self,
        request: tonic::Request<TransformVideoRequest>,
    ) -> std::result::Result<
        tonic::Response<TransformVideoResponse>,
        tonic::Status,
    > {
        todo!();
    }
}