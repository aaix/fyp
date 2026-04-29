-- ScyllaDB database schema

CREATE KEYSPACE dataservices WITH REPLICATION = {
    'class' : 'NetworkTopologyStrategy',
    -- datacenters
    'datacenter1' : 1
} AND TABLETS = {'enabled': false};

-- COALESCE on user_id
CREATE TABLE dataservices.user (
    user_id TIMEUUID,
    username TEXT, -- probably needs to be queryable so users can find users
    email TEXT,
    public_key BLOB, -- rsa public key
    opt_avatar_asset_id TIMEUUID, -- foreign key: asset.asset_id
    opt_public_profile boolean,
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
    encrypted_account_key BLOB,
    PRIMARY KEY (user_id, device_id)
);

-- Will have 2 rows per relationship
CREATE TABLE dataservices.relationship (
    user_id_a TIMEUUID,
    user_id_b TIMEUUID,
    created_at TIMESTAMP,
    relationship_type INT,
    -- 0 reserved

    -- 1 a requesting b
    -- 2 b requesting a

    -- 3 a friends with b

    -- 5 b blocked a
    -- 6 a blocked by b
    PRIMARY KEY (user_id_a, user_id_b, relationship_type)
);

CREATE TABLE dataservices.relationship_v2 (
    user_id_a TIMEUUID,
    user_id_b TIMEUUID,
    created_at TIMESTAMP,
    relationship_type INT,
    -- 0 reserved

    -- 1 a requesting b
    -- 2 b requesting a

    -- 3 a friends with b

    -- 5 b blocked a
    -- 6 a blocked by b
    -- 7 a following b
    -- 8 b following a
    PRIMARY KEY (user_id_a, relationship_type, user_id_b)
);


-- COALESCE on user_id
CREATE TABLE dataservices.user_num_relationships (
    user_id TIMEUUID,
    num_friends COUNTER,
    num_followers COUNTER,
    opt_num_following COUNTER, -- opt bc it was added later

    PRIMARY KEY (user_id)
);


CREATE TABLE dataservices.channel (
    channel_id TIMEUUID,
    channel_type INT,
    latest_bucket BIGINT,
    opt_channel_name BLOB, 
    channel_members set<TIMEUUID>,
    opt_channel_icon_asset_id TIMEUUID, 

    PRIMARY KEY (channel_id)
);

-- denormalized form for optimum querying performance
CREATE TABLE dataservices.user_channel (
    user_id TIMEUUID,
    channel_id TIMEUUID,

    opt_last_acked_message_id TIMEUUID,
    opt_last_acked_ctr BIGINT,

    encrypted_channel_key BLOB,
    opt_channel_name BLOB,
    opt_channel_icon_asset_id TIMEUUID,

    PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE dataservices.channel_counter (
    channel_id TIMEUUID,
    message_ctr COUNTER,
    PRIMARY KEY (channel_id)
);


CREATE TABLE dataservices.message (
    channel_id TIMEUUID, -- foreign key: message_channel.channel_id
    bucket BIGINT, -- bucket to stop partitions from getting too large (100mb max recommended)
    message_id TIMEUUID,
    author_id TIMEUUID,
    message_type INT,
    opt_last_edited TIMESTAMP,
    opt_content BLOB,
    opt_additional_content BLOB,
    opt_attachment_asset_id TIMEUUID,
    opt_in_reply_to TIMEUUID,

    -- we must know the bucket, however we can derive this from
    -- the message timestamp
    PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);



CREATE TABLE dataservices.post (
    post_id TIMEUUID,
    author_id TIMEUUID, -- foreign key: user.user_id
    asset_id TIMEUUID,
    post_type INT, -- 0: private, 1: image, 2: video, 3: short form
    content_type TEXT,
    opt_body TEXT,
    opt_last_edited TIMESTAMP,
    PRIMARY KEY (author_id, post_id), -- route will have to be /user/id/post/id
) WITH CLUSTERING ORDER BY (post_id DESC);

-- COALESCE post ON post_id
CREATE TABLE dataservices.post_v2 (
    post_id TIMEUUID,
    author_id TIMEUUID, -- foreign key: user.user_id
    asset_id TIMEUUID,
    timeline_type INT,
    is_private BOOLEAN,
    post_type INT, -- 1: image, 2: video, 3: short form
    opt_body TEXT,
    opt_last_edited TIMESTAMP,
    opt_large BOOLEAN, -- large  posts need special handling
    PRIMARY KEY ((author_id, timeline_type), post_id), -- route will have to be /user/id/post/id?t=1
) WITH CLUSTERING ORDER BY (post_id DESC);


-- COALESCE post_num_comments ON post_id
CREATE TABLE dataservices.post_num_counters (
    post_id TIMEUUID,
    post_likes COUNTER,
    post_comments COUNTER,
    PRIMARY KEY (post_id)
);


CREATE TABLE dataservices.user_timeline_meta  (
    user_id TIMEUUID,
    timeline_type INT,
    opt_last_fanned_in_at BIGINT, -- fan in following
    opt_fanned_in_up_to TIMEUUID,
    opt_explicit_fan_in_users set<TIMEUUID>, -- fan in new friends
    opt_exclude_users set<TIMEUUID>, -- "cache" list of recent people unfollowed, or removed as friends
    PRIMARY KEY (user_id, timeline_type)
);

CREATE TABLE dataservices.user_timeline_entry (
    user_id TIMEUUID,
    timeline_type INT, -- 0: main feed (image/video post), 1: short from (sf post)
    post_author_id TIMEUUID,
    post_id TIMEUUID,
    entry_type INT, --0: fanned out, --1: fanned in
    PRIMARY KEY ((user_id, timeline_type), post_id)
) WITH CLUSTERING ORDER BY (post_id DESC)
AND default_time_to_live = 7776000 -- 90 days
-- TODO: is this compaction strategy ok if we delete filtered entries
AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 5
};


-- COALESCE post_comment ON comment_id
CREATE TABLE dataservices.post_comment (
    post_id TIMEUUID,
    bucket int,
    comment_id TIMEUUID,
    author_id TIMEUUID,
    content TEXT,
    PRIMARY KEY ((post_id, bucket) comment_id)
) WITH CLUSTERING ORDER BY (comment_id DESC);

-- will require lwts for updating post counters
CREATE TABLE dataservices.post_like (
    post_id TIMEUUID, -- foreign key: post.post_id
    bucket BIGINT, -- derived from liker id so partition size limited
    liker_id TIMEUUID, -- foreign key: user.user_id
    PRIMARY KEY ((post_id, bucket), liker_id)
);

-- large posts dont use the bucket registry strategy, instead we assume there are likes for every bucket
-- this avoids the double write on like for large posts
CREATE TABLE dataservices.post_like_bucket_used (
    post_id TIMEUUID,
    bucket BIGINT,
    PRIMARY KEY (post_id)
);

CREATE TABLE dataservices.needs_gc (
    bucket BIGINT, 
    object_id TIMEUUID,
    garbage_type INT,
    garbage_flags BIGINT,
    PRIMARY KEY (bucket, object_id, garbage_type)
) WITH CLUSTERING ORDER BY (object_id ASC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_unit': 'DAYS', 'compaction_window_size': 1};
