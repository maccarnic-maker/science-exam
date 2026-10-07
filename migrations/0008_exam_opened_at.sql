-- Historical teacher opening times are unknown; do not fabricate them.
ALTER TABLE exams ADD COLUMN last_opened_at INTEGER;
