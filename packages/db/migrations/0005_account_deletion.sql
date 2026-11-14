ALTER TABLE user ADD COLUMN deletion_requested_at INTEGER;
ALTER TABLE user ADD COLUMN deletion_due_at INTEGER
  CONSTRAINT user_deletion_due_check
  CHECK ((deletion_due_at IS NULL) = (deletion_requested_at IS NULL)
    AND (deletion_due_at IS NULL OR deletion_due_at > deletion_requested_at));
ALTER TABLE user ADD COLUMN deleted_at INTEGER
  CONSTRAINT user_deleted_check
  CHECK (deleted_at IS NULL OR (deletion_due_at IS NOT NULL AND deleted_at >= deletion_due_at));
CREATE INDEX user_deletion_due_idx ON user (deletion_due_at, id)
  WHERE deletion_due_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX user_deleted_at_idx ON user (deleted_at, id)
  WHERE deleted_at IS NOT NULL;
