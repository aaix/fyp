ALTER TABLE dataservices.user_timeline_entry 
WITH default_time_to_live = 777600
AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 5
};