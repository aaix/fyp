from typing import Final


USERNAME_MAX_LENGTH: Final[int] = 24
USERNAME_MIN_LENGTH: Final[int] = 2

DEVICE_NAME_MAX_LENGTH: Final[int] = 32
DEVICE_NAME_MIN_LENGTH: Final[int] = 1

CHANNEL_NAME_MAX_LENGTH: Final[int] = 82 # 136 bytes b64 82 byte payload (48 byte name)
CHANNEL_NAME_MIN_LENGTH: Final[int] = 34 # 48b64 34 ciphertext

CHANNEL_MAX_NUM_MEMBERS: Final[int] = 15

MESSAGE_CONTENT_MAX_LENGTH: Final[int] = 1000
MESSAGE_ADDITIONAL_CONTENT_MAX_LENGTH: Final[int] = 128

USER_MAX_NUM_DEVICES: Final[int] = 15

MAX_MESSAGES_QUERYABLE: Final[int] = 50


ICON_MAX_UPLOAD_SIZE: Final[int] = 10 * 1000 * 1000  # 10 million bytes
CHAT_ATTACHMENT_MAX_SIZE: Final[int] = 50 * 1000 * 1000 # 50 million bytes
POST_MEDIA_MAX_UPLOAD_SIZE: Final[int] = 50 * 1000 * 1000 # 50 million bytes


POST_BODY_MAX_LENGTH: Final[int] = 2000

THUMBNAIL_MAX_WIDTH: Final[int] = 350
THUMBNAIL_MAX_HEIGHT: Final[int] = 1050 