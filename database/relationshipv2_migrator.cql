COPY dataservices.relationship (user_id_a, user_id_b, relationship_type, created_at) 
TO 'relationship_backup.csv' 
WITH HEADER = TRUE;

CREATE TABLE dataservices.relationship_v2 (
    user_id_a TIMEUUID,
    user_id_b TIMEUUID,
    created_at TIMESTAMP,
    relationship_type INT,
    PRIMARY KEY (user_id_a, relationship_type, user_id_b)
);


COPY dataservices.relationship_v2 (user_id_a, user_id_b, relationship_type, created_at) 
FROM 'relationship_backup.csv' 
WITH HEADER = TRUE;