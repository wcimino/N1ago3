-- Remove duplicate events keeping the first one (lowest id) for each (source, source_event_id)
DELETE FROM events_standard 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM events_standard 
    WHERE source_event_id IS NOT NULL
    GROUP BY source, source_event_id
) 
AND source_event_id IS NOT NULL
AND EXISTS (
    SELECT 1 
    FROM events_standard e2 
    WHERE e2.source = events_standard.source 
    AND e2.source_event_id = events_standard.source_event_id 
    AND e2.id < events_standard.id
);

-- Create unique index on (source, source_event_id) for events with non-null source_event_id
CREATE UNIQUE INDEX IF NOT EXISTS "idx_events_standard_source_event_id_unique" 
ON "events_standard" ("source", "source_event_id") 
WHERE "source_event_id" IS NOT NULL;
