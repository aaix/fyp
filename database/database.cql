-- ScyllaDB database schema

CREATE KEYSPACE dataservices WITH REPLICATION = {
    'class' : 'NetworkTopologyStrategy',
    -- datacenters
    'datacenter1' : 1
} AND TABLETS = {'enabled': false};

CREATE TABLE dataservices.user (
    user_id TIMEUUID,
    username TEXT, -- probably needs to be queryable so users can find users
    public_key BLOB, -- rsa public key
    opt_avatar_asset_id TIMEUUID, -- foreign key: asset.asset_id
    PRIMARY KEY (user_id),
);

CREATE TABLE dataservices.user_by_username (
    username TEXT,
    user_id TIMEUUID, -- foreign key: user.user_id
    PRIMARY KEY (username)
);

-- should probably limit number of devices as public_key isnt indexed
CREATE TABLE dataservices.user_device (
    user_id TIMEUUID, -- foreign key: user.user_id
    device_id TIMEUUID,
    device_name TEXT,
    device_public_key BLOB, -- RSA public key for encrypting account key
    -- device will use its private key to decrypt this
    encypted_account_key BLOB,
    PRIMARY KEY (user_id, device_id)
);

CREATE TABLE dataservices.friendship (
    lower__user_id TIMEUUID, -- foreign key: user.user_id
    higher__user_id TIMEUUID, -- foreign key: user.user_id
    created_at TIMESTAMP,
    PRIMARY KEY (lower__user_id, higher__user_id)
);

CREATE TABLE dataservices.friendship_request (
    requester__user_id TIMEUUID, -- foreign key: user.user_id
    recipient__user_id TIMEUUID, -- foreign key: user.user_id
    PRIMARY KEY (recipient__user_id, requester__user_id)-- users can look up their sent requests
);
CREATE INDEX friendship_request_by_requester ON dataservices.friendship_request (requester__user_id);


CREATE TABLE dataservices.blocked_user (
    blocker__user_id TIMEUUID, -- foreign key: user.user_id
    blocked__user_id TIMEUUID, -- foreign key: user.user_id
    PRIMARY KEY (blocker__user_id, blocked__user_id),
    -- no need for index on blocked because we always know both ids in an interaction
);

CREATE TABLE dataservices.message_channel (
    channel_id UUID,
    name TEXT,
    channel_type INT, -- enum: 0 = direct message, 1 = group chat
    owner__user_id TIMEUUID, -- foreign key: user.user_id
    PRIMARY KEY (channel_id)
);

CREATE TABLE dataservices.message_channel_member (
    channel_id UUID, -- foreign key: message_channel.channel_id
    member__user_id TIMEUUID, -- foreign key: user.user_id
    joined_at TIMESTAMP,
    encrypyed_shared_key BLOB, -- shared key encrypted by account public key
    PRIMARY KEY (channel_id, member__user_id),
);
CREATE INDEX message_channel_by_member ON dataservices.message_channel_member (member__user_id);

CREATE TABLE dataservices.message (
    channel_id UUID, -- foreign key: message_channel.channel_id
    bucket BIGINT, -- bucket to stop partitions from getting too large (100mb max recommended)
    message_id TIMEUUID,
    message_type INT,
    opt_last_edited TIMESTAMP,
    opt_content TEXT,
    PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

CREATE TABLE dataservices.message_attachment (
    message_id TIMEUUID, -- foreign key: message.message_id
    asset_id TIMEUUID, -- foreign key: asset.asset_id
    PRIMARY KEY (message_id, asset_id)
);

-- storage path should be type/bucket_id/asset_id/file_name, we strip '-' from all UUID displays
-- e.g. avatar/0e0f41818ceb4e61bed9ba94ac7e170d/0e0f41818ceb4e61bed9ba94ac7e170d/avatar.png
CREATE TABLE dataservices.asset (
    asset_id TIMEUUID,
    bucket_id UUID, -- potential foreign key: user.user_id or post.post_id
    asset_type INT, -- enum: 0 = avatar, 1 = permanent post, 2 = temporary post, 3 = message attachment
    content_type TEXT, -- MIME type
    opt_file_name TEXT,
    PRIMARY KEY (asset_id)
);

CREATE TABLE dataservices.post (
    post_id TIMEUUID,
    author__user_id TIMEUUID, -- foreign key: user.user_id
    body TEXT,
    last_edited TIMESTAMP,
    opt_likes INT, -- denormalized count of likes
    opt_comments INT, -- denormalized count of comments
    PRIMARY KEY (post_id),
);
CREATE INDEX post_by_author ON dataservices.post (author__user_id);


CREATE TABLE dataservices.post_comment (
    comment_id TIMEUUID,
    post_id TIMEUUID, -- foreign key: post.post_id
    author__user_id UUID, -- foreign key: user.user_id
    body TEXT,
    opt_last_edited TIMESTAMP,
    PRIMARY KEY (post_id, comment_id),
);

CREATE TABLE dataservices.post_like (
    post_id TIMEUUID, -- foreign key: post.post_id
    liker__user_id TIMEUUID, -- foreign key: user.user_id
    PRIMARY KEY (post_id, liker__user_id)
);

CREATE TABLE dataservices.temporary_post (
    temp_post_id TIMEUUID,
    author__user_id UUID, -- foreign key: user.user_id
    PRIMARY KEY (author__user_id, temp_post_id)
);

CREATE TABLE dataservices.multiuse_post_attachment ( -- used for temporary & permanent posts
    multiuse_post_id TIMEUUID, -- foreign key: can be temp_post_id or post_id
    asset_id TIMEUUID, -- foreign key: assets.asset_id
    PRIMARY KEY (multiuse_post_id, asset_id)
);
