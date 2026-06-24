

CREATE TABLE IF NOT EXISTS categories
(
  id BIGSERIAL PRIMARY KEY,

  slug TEXT NOT NULL UNIQUE,

  name TEXT NOT NULL,

  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads
(
  id BIGSERIAL PRIMARY KEY,

  category_id BIGINT NOT NULL REFERENCES categories(id),

  author_user_id BIGINT NOT NULL REFERENCES users(id),

  title TEXT NOT NULL,
  
  body TEXT NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_threads_category_created_at ON threads(category_id, created_at DESC); 


INSERT INTO categories (slug, name, description) VALUES
('general', 'General Discussion', 'A place for general discussion and community topics.'),
('q-and-a', 'Q&A', 'Ask questions and get answers from the community.'),
('showcase', 'Showcase', 'Share your projects and get feedback from the community.'),
('help', 'Help', 'Get help with using the platform or troubleshooting issues.')
ON CONFLICT (slug) DO NOTHING;