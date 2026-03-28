from collections.abc import Iterable, Callable, Hashable
from collections import defaultdict
from typing import Awaitable



async def bucketby[K: Hashable, V](iterable: Iterable[V], bucketer: Callable[[V], Awaitable[K]]) -> dict[K, list[V]]:
    """Turn an Iterable[T] into a dict of {k: {f(v),} = k}, the bucketer is not run in parallel"""
    buckets: dict[K, list[V]] = defaultdict(list)

    for value in iterable:
        buckets[await bucketer(value)].append(value)

    return buckets