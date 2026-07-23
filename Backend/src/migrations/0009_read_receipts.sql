-- DM read cursors: tracks the last message each user has read in each conversation
CREATE TABLE IF NOT EXISTS dm_read_cursors (
  owner_user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_msg_id BIGINT NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_user_id, other_user_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_read_cursors_owner
  ON dm_read_cursors(owner_user_id);
