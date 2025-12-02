/*
TABLE user_device
*/

use crate::db_conn::db;
use crate::errors::DSResult;
use crate::protos::user_service::{self, CreateDeviceRequest, DeleteDeviceRequest, DeleteDeviceResponse, DeviceObjectResponse, ReadDevicesRequest, ReadDevicesResponse, UpdateDeviceRequest};

use scylla::statement::prepared::PreparedStatement;
use tonic::{Request, Response, Status};
use user_service::user_device_service_server::{UserDeviceService, UserDeviceServiceServer};

#[derive(Debug)]
pub struct ScyallaUserDeviceService {
    create_device_prepared: PreparedStatement,
    read_devices_prepared: PreparedStatement,
    update_device_prepared: PreparedStatement,
    delete_device_prepared: PreparedStatement,
}

impl ScyallaUserDeviceService {
    pub async fn service() -> UserDeviceServiceServer<Self> {

        let create_device_prepared = db().await.prepare(
            "INSERT INTO dataservices.user_device \
            (user_id, device_id, device_name, device_public_key, encrypted_account_key) \
            VALUES (?, ?, ?, ?, ?)"
        ).await.unwrap();

        let read_devices_prepared = db().await.prepare(
            "SELECT * FROM dataservices.user_device WHERE user_id = ?"
        ).await.unwrap();

        let update_device_prepared = db().await.prepare(
            "UPDATE dataservices.user_device SET device_name = ?, device_public_key = ?, encrypted_account_key = ?\
            WHERE user_id = ? AND device_id = ?"
        ).await.unwrap();

        let delete_device_prepared = db().await.prepare(
            "DELETE FROM dataservices.user_device WHERE user_id = ? AND device_id = ?"
        ).await.unwrap();

        UserDeviceServiceServer::new(Self {
            create_device_prepared,
            read_devices_prepared,
            update_device_prepared,
            delete_device_prepared,
        })
    }

    async fn create_device_impl(
        &self,
        request: Request<CreateDeviceRequest>
    ) -> DSResult<Response<DeviceObjectResponse>> {
        todo!()
    }
    
    async fn read_devices_impl(
        &self,
        request: Request<ReadDevicesRequest>
    ) -> DSResult<Response<ReadDevicesResponse>> {
        todo!()
    }
    
    async fn update_device_impl(
        &self,
        request: Request<UpdateDeviceRequest>
    ) -> DSResult<Response<DeviceObjectResponse>> {
        todo!()
    }

    async fn delete_device_impl(
        &self,
        request: Request<DeleteDeviceRequest>
    ) -> DSResult<Response<DeleteDeviceResponse>> {
        todo!()
    }

}

#[tonic::async_trait]
impl UserDeviceService for ScyallaUserDeviceService {
    async fn create_device(
        &self,
        request: Request<CreateDeviceRequest>
    ) -> Result<Response<DeviceObjectResponse>, Status> {
        Ok(self.create_device_impl(request).await?)
    }

    async fn read_devices(
        &self,
        request: Request<ReadDevicesRequest>
    ) -> Result<Response<ReadDevicesResponse>, Status> {
        Ok(self.read_devices_impl(request).await?)
    }
    async fn update_device(
        &self,
        request: Request<UpdateDeviceRequest>
    ) -> Result<Response<DeviceObjectResponse>, Status> {
        Ok(self.update_device_impl(request).await?)
    }
    async fn delete_device(
        &self,
        request: Request<DeleteDeviceRequest>
    ) -> Result<Response<DeleteDeviceResponse>, Status> {
        Ok(self.delete_device_impl(request).await?)
    }
}