use std::net::IpAddr;

use redis::{aio::MultiplexedConnection, RedisResult};


pub struct BigPictureNode {
    connection: MultiplexedConnection,
    join_channel: &'static str,
    leave_channel: &'static str,
    member_set: &'static str,
    ip: String
}

impl BigPictureNode {
    pub async fn new(
        valkey_uri: &str,
        join_channel: &'static str,
        leave_channel: &'static str,
        member_set: &'static str,
        current_ip: IpAddr
    ) -> RedisResult<Self> {
        let client = redis::Client::open(valkey_uri)?;
        let connection = client.get_multiplexed_async_connection().await?;

        let ip = current_ip.to_string();

        Ok(Self {
            connection,
            join_channel,
            leave_channel,
            member_set,
            ip,
        })
    }

    pub async fn join(&self) -> RedisResult<()> {
        let mut conn = self.connection.clone();
        let mut pipe = redis::pipe();

        pipe.atomic()
            .sadd(&self.member_set, &self.ip)
            .publish(&self.join_channel, &self.ip)
            .query_async(&mut conn)
            .await
    }

    pub async fn leave(&self) -> RedisResult<()> {
        let mut conn = self.connection.clone();
        let mut pipe = redis::pipe();

        pipe.atomic()
            .srem(&self.member_set, &self.ip)
            .publish(&self.leave_channel, &self.ip)
            .query_async(&mut conn)
            .await
    }
}