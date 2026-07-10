
CREATE TABLE IF NOT EXISTS replies 
(
  id BIGSERIAL PRIMARY KEY,

  thread_id BIGINT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,

  author_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  body TEXT NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()

);

  -- author id is one who writes the reply

CREATE INDEX IF NOT EXISTS idx_replies_thread_created_at
ON replies(thread_id, created_at ASC);


CREATE TABLE IF NOT EXISTS thread_reactions
(
  
  id BIGSERIAL PRIMARY KEY,

  thread_id BIGINT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,

  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  reaction_type VARCHAR(50) NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_thread_reaction UNIQUE (thread_id, user_id) 
);


-- above user id of those who react to the thread
CREATE INDEX IF NOT EXISTS idx_thread_reactions_thread
ON thread_reactions(thread_id);