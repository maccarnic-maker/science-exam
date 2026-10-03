ALTER TABLE exam_sessions ADD COLUMN tab_switches INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exam_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress';
ALTER TABLE exam_sessions ADD COLUMN last_active_at INTEGER DEFAULT (unixepoch());
