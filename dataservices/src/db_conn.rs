use tokio::sync::OnceCell;
use scylla::client::session::Session;
use scylla::client::session_builder::SessionBuilder;

static CONN: OnceCell<Session> = OnceCell::const_new();

pub async fn db() -> &'static Session {
    CONN.get_or_init(|| async {
        let uri = std::env::var("SCYLLA_URI").unwrap();
        let client = SessionBuilder::new()
            .known_node(uri)
            .build()
            .await
            .unwrap();

        client
    })
    .await
}