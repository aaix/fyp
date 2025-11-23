-- ScyllaDB database schema

CREATE KEYSPACE IF NOT EXISTS dataservices WITH REPLICATION = {
    'class' : 'NetworkTopologyStrategy',
    -- datacenters
    'europe-west2' : 3 -- london
    'us-east4' : 3 -- northern virginia
    -- maybe add belgium? (europe-west1)
};

CREATE TABLE user (
    user_id UUID,
    username TEXT, -- probably needs to be queryable so users can find users
    created_at TIMESTAMP,
    public_key , -- ed25519 public key
    PRIMARY KEY (id),
    INDEX (username),
)

-- should probably limit number of devices as public_key isnt indexed
CREATE TABLE user_device (
    user_id UUID, -- foreign key: user.user_id
    device_id UUID,
    device_name TEXT,
    device_public_key BLOB, -- RSA public key for encrypting account key
    -- device will use its private key to decrypt this
    encypted_account_key BLOB,
    created_at TIMESTAMP,
    PRIMARY KEY (device__user_id)
)

CREATE TABLE friendship (
    lower__user_id UUID,
    higher__user_id UUID,
    PRIMARY KEY (lower__user_id, higher__user_id)
)

CREATE TABLE friendship_request (
    requester__user_id UUID, -- foreign key: user.user_id
    recipient__user_id UUID, -- foreign key: user.user_id
    PRIMARY KEY (recipient__user_id, requester__user_id),
    INDEX (requester__user_id) -- users can look up their sent requests
)

CREATE TABLE blocked_user (
    blocker__user_id UUID, -- foreign key: user.user_id
    blocked__user_id UUID, -- foreign key: user.user_id
    PRIMARY KEY (blocker__user_id, blocked__user_id),
    -- no need for index on blocked because we always know both ids in an interaction
)

CREATE TABLE message_channel (
    channel_id UUID,
    name VARCHAR(96),
    channel_type INT, -- enum: 0 = direct message, 1 = group chat
    owner__user_id UUID, -- foreign key: user.user_id
    PRIMARY KEY (channel_id)
)

CREATE TABLE message_channel_member (
    channel_id UUID, -- foreign key: message_channel.channel_id
    member__user_id UUID, -- foreign key: user.user_id
    joined_at TIMESTAMP,
    encrypyed_shared_key BLOB, -- shared key encrypted by account public key
    PRIMARY KEY (channel_id, member__user_id),
    INDEX (member__user_id) -- this is how users fetch their channels
)

CREATE TABLE message (
    channel_id UUID,
    bucket BIGINT, -- bucket to stop partitions from getting too large (100mb max recommended)
    message_id UUID,
    message_type INT,
    message_sent TIMESTAMP,
    last_edited TIMESTAMP,
    content TEXT,
    PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_sent DESC);

CREATE TABLE message_attachment (
    message_id UUID,
    asset_id UUID,
    PRIMARY KEY (message_id, asset_id)
)

-- storage path should be type/bucket_id/asset_id/file_name, we strip '-' from all UUID displays
-- e.g. avatar/0e0f41818ceb4e61bed9ba94ac7e170d/0e0f41818ceb4e61bed9ba94ac7e170d/avatar.png
CREATE TABLE asset (
    asset_id UUID,
    bucket_id UUID,
    asset_type INT, -- enum: 0 = avatar, 1 = permanent post, 2 = temporary post, 3 = message attachment
    content_type TEXT, -- MIME type
    file_name TEXT,
    PRIMARY KEY (asset_id)
)

CREATE TABLE post (
    post_id UUID,
    author__user_id UUID, -- foreign key: user.user_id
    body TEXT,
    created_at TIMESTAMP,
    last_edited TIMESTAMP,
    likes INT, -- denormalized count of likes
    comments INT, -- denormalized count of comments
    PRIMARY KEY (post_id),
    INDEX (author__user_id),
)

CREATE TABLE post_attachment (
    post_id UUID, -- foreign key: post.post_id
    asset_id UUID, -- foreign key: assets.asset_id
    PRIMARY KEY (post_id, asset_id)
)

CREATE TABLE post_comment (
    comment_id UUID,
    post_id UUID, -- foreign key: post.post_id
    author__user_id UUID, -- foreign key: user.user_id
    body TEXT,
    created_at TIMESTAMP,
    last_edited TIMESTAMP,
    PRIMARY KEY (post_id, comment_id),
)

CREATE TABLE post_like (
    post_id UUID, -- foreign key: post.post_id
    liker__user_id UUID, -- foreign key: user.user_id
    PRIMARY KEY (post_id, liker__user_id)
)

CREATE TABLE temporary_post (
    temp_post_id UUID,
    author__user_id UUID, -- foreign key: user.user_id
    created_at TIMESTAMP,
    PRIMARY KEY (author__user_id, temp_post_id)
)

CREATE TABLE multiuse_post_attachment ( -- used for temporary & permanent posts
    temp_post_id UUID, -- foreign key: temporary_post.temp_post_id
    asset_id UUID, -- foreign key: assets.asset_id
    PRIMARY KEY (temp_post_id, asset_id)
)