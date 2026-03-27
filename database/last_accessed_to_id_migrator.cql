ALTER TABLE dataservices.user_channel DROP last_accessed;
ALTER TABLE dataservices.user_channel ADD (opt_last_acked_message_id TIMEUUID);