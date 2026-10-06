-- Existing exams keep their original 30-question assessment size.
ALTER TABLE exams ADD COLUMN draw_count INTEGER;
ALTER TABLE exams ADD COLUMN bank_exam_id TEXT REFERENCES exams(id);
UPDATE exams SET draw_count = (SELECT COUNT(*) FROM questions WHERE exam_id = exams.id);
ALTER TABLE exam_sessions ADD COLUMN seen_questions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE questions ADD COLUMN topic TEXT NOT NULL DEFAULT 'เนื้อหาเดิม';
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_choices_question ON choices(question_id);
