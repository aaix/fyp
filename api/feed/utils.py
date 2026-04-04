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

    # for general fan on CONF_FAN_IN_DELAY (last_fanned_in_at is a ms timestamp)
    time_based = (1000 * (time_now - CONF_FAN_IN_DELAY)) > (meta.last_fanned_in_at)


    if before and (before := id_uuid(before)) and meta.fanned_in_up_to and (fanned_in_up_to := id_uuid(meta.fanned_in_up_to)):
        # fan in if the user  has scrolled down to before we have fanned in
        before_based = before <= fanned_in_up_to

        # unless it was longer than 60 days ago
        before_time = id_timestamp(before).timestamp()

        before_based = before_based and (before_time > time_now - CONF_FEED_MAX_HISTORY) 
    else:
        before_based = False

    explicit_based = len(meta.explicit_fan_in_users) > 0
    return FanInReason(time_based=time_based, before_based=before_based, explicit_based=explicit_based)