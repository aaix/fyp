//! Elasticsearch client for username search indexing (mirrors [`crate::db_conn`] pattern).

use elasticsearch::http::transport::Transport;
use elasticsearch::http::StatusCode;
use elasticsearch::indices::{IndicesCreateParts, IndicesExistsParts};
use elasticsearch::{DeleteParts, Elasticsearch, IndexParts};
use serde_json::json;
use std::sync::OnceLock;

use tokio::sync::{Mutex, OnceCell};

use crate::errors::{DSResult};

pub const USERNAMES_INDEX: &str = "usernames";

static ES: OnceCell<Elasticsearch> = OnceCell::const_new();
static INDEX_ENSURE: OnceLock<Mutex<bool>> = OnceLock::new();

/// lazily initialised elasticsearh client
pub async fn es_client() -> &'static Elasticsearch {
    ES.get_or_init(|| async {
        let uri = std::env::var("ELASTICSEARCH_URI").expect("ELASTICSEARCH_URI must be set");
        let transport = Transport::single_node(&uri).expect("ELASTICSEARCH_URI must be a valid URL");
        Elasticsearch::new(transport)
    })
    .await
}

async fn ensure_usernames_index(client: &Elasticsearch) -> DSResult<()> {
    let lock = INDEX_ENSURE.get_or_init(|| Mutex::new(false));
    let mut done = lock.lock().await;
    if *done {
        return Ok(());
    }

    let exists = client
        .indices()
        .exists(IndicesExistsParts::Index(&[USERNAMES_INDEX]))
        .send()
        .await?;

    if exists.status_code() == StatusCode::NOT_FOUND {
        let body = json!({
            "mappings": {
                "properties": {
                    "user_id": { "type": "keyword" },
                    "username": {
                        "type": "text",
                        "analyzer": "standard",
                        "fields": {
                            "keyword": { "type": "keyword" }
                        }
                    }
                }
            }
        });
        let create = client
            .indices()
            .create(IndicesCreateParts::Index(USERNAMES_INDEX))
            .body(body)
            .send()
            .await?;
        create.error_for_status_code()?;
    } else {
        exists.error_for_status_code()?;
    }

    *done = true;
    Ok(())
}

pub async fn index_username(user_id: &str, username: &str) -> DSResult<()> {
    let client = es_client().await;
    ensure_usernames_index(client).await?;

    let body = json!({
        "user_id": user_id,
        "username": username,
    });

    let res = client
        .index(IndexParts::IndexId(USERNAMES_INDEX, user_id))
        .body(body)
        .send()
        .await?;
    res.error_for_status_code()?;
    Ok(())
}

pub async fn delete_username_doc(user_id: &str) -> DSResult<()> {
    let client = es_client().await;
    let res = client
        .delete(DeleteParts::IndexId(USERNAMES_INDEX, user_id))
        .send()
        .await?;

    // fail silently
    if res.status_code() == StatusCode::NOT_FOUND {
        return Ok(());
    }
    res.error_for_status_code()?;
    Ok(())
}
