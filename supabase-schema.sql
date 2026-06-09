-- 1. Create generic key-value tables where `data` is a JSONB column.
-- This matches Firestore's NoSQL behavior perfectly.

CREATE TABLE users (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE users_profiles (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE user_courses (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE user_footages (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb,
  url text,
  updated_at timestamp DEFAULT now()
);

CREATE TABLE user_navigation (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE shared_courses (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE shared_courses_votes (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE bug_reports (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE follows (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE users_achievements (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE community_posts (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE test_connection (
  id text PRIMARY KEY,
  data jsonb DEFAULT '{}'::jsonb
);

INSERT INTO test_connection (id, data) VALUES ('connection', '{"status": "ok"}');

-- 2. Disable Row Level Security temporarily to allow the app to work out of the box in development.
-- (You can enable RLS later in Supabase dashboard)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE users_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_footages DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_navigation DISABLE ROW LEVEL SECURITY;
ALTER TABLE shared_courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE shared_courses_votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE follows DISABLE ROW LEVEL SECURITY;
ALTER TABLE users_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_connection DISABLE ROW LEVEL SECURITY;

-- 3. Storage bucket for footages
INSERT INTO storage.buckets (id, name, public) VALUES ('footages', 'footages', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'footages');

CREATE POLICY "Public Insert Access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'footages');

CREATE POLICY "Public Update Access"
  ON storage.objects FOR UPDATE
  WITH CHECK (bucket_id = 'footages');

CREATE POLICY "Public Delete Access"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'footages');
