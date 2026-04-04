from dataclasses import dataclass
from datetime import UTC, datetime


from shared.py.grpc.id import id_t, id_timestamp, id_uuid, puuid_uuid
from shared.py.grpcgen.feed_pb2 import FeedMetaResponse


CONF_FAN_IN_DELAY = 5 * 60 # 5 minutes

CONF_FEED_MAX_HISTORY = 60 * 24 * 60 * 60 # 60 days


@dataclass(kw_only=True)
class FanInReason:
    time_based: bool
    before_based: bool
    explicit_based: bool

    def __bool__(self) -> bool:
        return self.time_based or self.before_based



async def needs_fan_in(meta: FeedMetaResponse, before: id_t | None) -> FanInReason:

    time_now = datetime.now(UTC).timestamp()

    # for general fan on CONF_FAN_IN_DELAY
    time_based = time_now - CONF_FAN_IN_DELAY > (meta.last_fanned_in_at)


    # fan in if the user  has scrolled down to before we have fanned in
    fanned_in_up_to = id_timestamp(meta.fanned_in_up_to)
    fanned_in_up_to_time = fanned_in_up_to.timestamp() if fanned_in_up_to else 0

    before_time = id_timestamp(before) if before else None
    if before_time:
        # only fan up to max history days
        floor = max(before_time.timestamp(), time_now - CONF_FEED_MAX_HISTORY)
        before_based = floor < fanned_in_up_to_time
    else:
        before_based = False

    explicit_based = len(meta.explicit_fan_in_users) > 0
    return FanInReason(time_based=time_based, before_based=before_based, explicit_based=explicit_based)