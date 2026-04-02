

from enum import Enum, IntEnum

class StrTimelineType(str, Enum):
    _MAIN = "feed"
    _SHORT = "short"

    def to_enum(self) -> TimelineType:
        match self:
            case self._MAIN:
                return TimelineType.MAIN
            case self._SHORT:
                return TimelineType.SHORT_FORM


class TimelineType(IntEnum):
    MAIN = 0
    SHORT_FORM = 1