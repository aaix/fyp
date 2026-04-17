import asyncio
from uuid import UUID

from elasticsearch import AsyncElasticsearch

from shared.py.discovery import DiscoveryManager
from shared.py.elasticsearch import USERNAMES_INDEX

discovery = DiscoveryManager()

_lock = asyncio.Lock()
_client: AsyncElasticsearch | None = None


async def _client_get() -> AsyncElasticsearch:
    global _client
    async with _lock:
        if _client is None:
            uri = discovery.discover_elasticsearch()
            _client = AsyncElasticsearch(hosts=[uri])
        return _client


async def search_user_ids_by_username(q: str, *, size: int = 25) -> list[UUID]:
    es = await _client_get()
    # match + match_bool_prefix (not query_string) so Lucene operators are not applied to user text
    query = {
        "bool": {
            "should": [
                {
                    "match": {
                        "username": {
                            "query": q,
                            "fuzziness": "AUTO",
                            "prefix_length": 1,
                        }
                    }
                },
                {
                    "match_bool_prefix": {
                        "username.keyword": {
                            "query": q,
                            "boost": 2.0,
                        }
                    }
                },
            ],
            "minimum_should_match": 1,
        }
    }
    res = await es.search(index=USERNAMES_INDEX, query=query, size=size)
    hits = res["hits"]["hits"]
    out: list[UUID] = []
    for h in hits:
        src = h.get("_source") or {}
        uid = src.get("user_id")
        if uid is None and h.get("_id"):
            uid = h["_id"]
        if uid is None:
            continue
        out.append(UUID(str(uid)))
    return out
