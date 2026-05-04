use crate::db_conn::db;
use crate::errors::DSResult;
use crate::helpers::gen_timeuuid;
use crate::models::user_device::UserDevice;
use crate::protos::dataservices::user_service::{self, CreateDeviceRequest, DeleteDeviceRequest, DeleteDeviceResponse, DeviceObjectResponse, ReadDeviceRequest, ReadDevicesRequest, ReadDevicesResponse, UpdateDeviceRequest};
use crate::protos::plib::AllignedCqlTimeuuid;
use crate::req_tuuid;

use scylla::statement::prepared::PreparedStatement;
use scylla::value::{MaybeUnset};
use tonic::{Request, Response, Status};
use user_service::user_device_service_server::{UserDeviceService, UserDeviceServiceServer};

#[derive(Debug)]
pub struct ScyallaUserDeviceService {
    create_device_prepared: PreparedStatement,
    read_devices_prepared: PreparedStatement,
    read_device_prepared: PreparedStatement,
    update_device_prepared: PreparedStatement,
    delete_device_prepared: PreparedStatement,
}

impl ScyallaUserDeviceService {
    
    pub async fn server() -> Option<UserDeviceServiceServer<Self>> {
        let server = Self::new().await;
        if let Err(e) = &server {
            tracing::error!("Error creating UserDeviceService server: {:?}", e);
        };
        server.ok()
    }

    pub async fn new() -> Result<UserDeviceServiceServer<Self>, Box<dyn std::error::Error>> {

        let create_device_prepared = db().await.prepare(
            "INSERT INTO dataservices.user_device \
            (user_id, device_id, device_name, device_public_key, encrypted_account_key) \
            VALUES (?, ?, ?, ?, ?)"
        ).await?;

        let read_devices_prepared = db().await.prepare(
            "SELECT * FROM dataservices.user_device WHERE user_id = ?"
        ).await?;

        let read_device_prepared = db().await.prepare(
            "SELECT * FROM dataservices.user_device WHERE user_id = ? AND device_id = ?"
        ).await?;

        let update_device_prepared = db().await.prepare(
            "UPDATE dataservices.user_device SET device_name = ?, device_public_key = ?, encrypted_account_key = ?\
            WHERE user_id = ? AND device_id = ?"
        ).await?;

        let delete_device_prepared = db().await.prepare(
            "DELETE FROM dataservices.user_device WHERE user_id = ? AND device_id = ?"
        ).await?;

        Ok(UserDeviceServiceServer::new(Self {
            create_device_prepared,
            read_devices_prepared,
            read_device_prepared,
            update_device_prepared,
            delete_device_prepared,
        }))
    }

    async fn _read_device(
        &self,
        user_id: AllignedCqlTimeuuid,
        device_id: AllignedCqlTimeuuid
    ) -> DSResult<DeviceObjectResponse> {

        let res = db().await.execute_unpaged(
            &self.read_device_prepared, (&user_id, device_id,)
        ).await?;

        let row = res.into_rows_result()?.first_row::<UserDevice>()?;

        Ok(DeviceObjectResponse {
            device_id: Some(row.device_id.into()),
            user_id: Some(row.user_id.into()),
            device_name: row.device_name,
            device_public_key: row.device_public_key,
            encrypted_account_key: row.encrypted_account_key,
        })

    }


    async fn create_device_impl(
        &self,
        request: Request<CreateDeviceRequest>
    ) -> DSResult<Response<DeviceObjectResponse>> {

        let device_id = gen_timeuuid();

        let user_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id)?;
        let owned = request.into_inner();
        let device_name = owned.device_name;
        let device_public_key = owned.public_key;
        let encrypted_account_key = owned.encrypted_account_key;

        db().await.execute_unpaged(
            &self.create_device_prepared,
            (
                &user_id,
                &device_id,
                &device_name,
                &device_public_key,
                &encrypted_account_key,
            )
        ).await?;


        Ok(Response::new(DeviceObjectResponse {
            device_id: Some(device_id.into()),
            user_id: Some(user_id.into()),
            device_name,
            device_public_key,
            encrypted_account_key,
        }))
    }
    
    async fn read_device_impl(
        &self,
        request: Request<ReadDeviceRequest>
    ) -> DSResult<Response<DeviceObjectResponse>> {
        let user_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id)?;
        let device_id: AllignedCqlTimeuuid = req_tuuid!(request, device_id)?;

        Ok(Response::new(self._read_device(user_id, device_id).await?))
    }


    async fn read_devices_impl(
        &self,
        request: Request<ReadDevicesRequest>
    ) -> DSResult<Response<ReadDevicesResponse>> {
        
        let user_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id)?;

        // we dont need pagination as there is a device limit
        let rows = db().await.execute_unpaged(
            &self.read_devices_prepared, (&user_id,)
        ).await?.into_rows_result()?;

        let q = rows.rows::<UserDevice>()?;

        let response = q.map(|d_opt| {
            d_opt.map(|device|
                DeviceObjectResponse {
                    user_id: Some(device.user_id.into()),
                    device_id: Some(device.device_id.into()),
                    device_name: device.device_name,
                    device_public_key: device.device_public_key,
                    encrypted_account_key: device.encrypted_account_key,
                })
        }).collect::<Result<Vec<DeviceObjectResponse>, _>>()?;

        
        Ok(Response::new(ReadDevicesResponse {
            device_count: response.len() as i32,
            devices: response,

        }))
    }
    
    async fn update_device_impl(
        &self,
        request: Request<UpdateDeviceRequest>
    ) -> DSResult<Response<DeviceObjectResponse>> {


        let user_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id)?;
        let device_id: AllignedCqlTimeuuid = req_tuuid!(request, device_id)?;

        let owned = request.into_inner();

        let device_name = MaybeUnset::from_option(owned.device_name);
        let device_public_key = MaybeUnset::from_option(owned.device_public_key);
        let encrypted_account_key = MaybeUnset::from_option(owned.encrypted_account_key);
        
        db().await.execute_unpaged(
            &self.update_device_prepared,
            (
                &device_name,
                &device_public_key,
                &encrypted_account_key,
                &user_id,
                &device_id,
            )
        ).await?;
        
        Ok(Response::new(self._read_device(user_id, device_id).await?))

    }

    async fn delete_device_impl(
        &self,
        request: Request<DeleteDeviceRequest>
    ) -> DSResult<Response<DeleteDeviceResponse>> {
        let user_id: AllignedCqlTimeuuid = req_tuuid!(request, user_id)?;
        let device_id: AllignedCqlTimeuuid = req_tuuid!(request, device_id)?;

        db().await.execute_unpaged(
            &self.delete_device_prepared,
            (&user_id, &device_id)
        ).await?;
        Ok(Response::new(DeleteDeviceResponse {}))
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

    async fn read_device(
        &self,
        request: Request<ReadDeviceRequest>
    ) -> Result<Response<DeviceObjectResponse>, Status> {
        Ok(self.read_device_impl(request).await?)
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