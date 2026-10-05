ALTER TABLE exam_sessions ADD COLUMN question_order TEXT;
ALTER TABLE exam_sessions ADD COLUMN draft_answers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE exam_sessions ADD COLUMN progress_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exam_sessions ADD COLUMN progress_token TEXT;
