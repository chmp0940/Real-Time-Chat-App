
CREATE TABLE IF NOT EXISTS direct_messages(
  id BIGSERIAL PRIMARY KEY,

  sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  receipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  body TEXT,

  image_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dm_sender_receipent_created_at ON direct_messages(sender_user_id, receipient_user_id, created_at DESC);

