-- PathwayAI initial schema. Table definitions are documented in
-- `backend/insforge-schema.md`.

-- gen_random_uuid() (Postgres 13+ / typical Supabase & InsForge setups)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  name text,
  display_name text,
  role text,
  industry text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- resumes
-- ---------------------------------------------------------------------------
CREATE TABLE resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  file_url text,
  storage_key text,
  raw_text text,
  parsed_name text,
  parsed_email text,
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_resumes_user_id ON resumes (user_id);

-- ---------------------------------------------------------------------------
-- job_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE job_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_url text,
  job_title text,
  company text,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_profiles_user_id ON job_profiles (user_id);

-- ---------------------------------------------------------------------------
-- gap_reports
-- ---------------------------------------------------------------------------
CREATE TABLE gap_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_profile_id uuid REFERENCES job_profiles (id) ON DELETE SET NULL,
  match_score integer,
  final_score integer,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gap_reports_user_id ON gap_reports (user_id);
CREATE INDEX idx_gap_reports_job_profile_id ON gap_reports (job_profile_id);

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
CREATE TABLE assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text,
  industry text,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer,
  readiness integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assessments_user_id ON assessments (user_id);

-- ---------------------------------------------------------------------------
-- learning_progress
-- (user_id is text to match the API’s opaque string: email, temp id, or uuid)
-- ---------------------------------------------------------------------------
CREATE TABLE learning_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  module_id text NOT NULL,
  lesson_index integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id, lesson_index)
);

CREATE INDEX idx_learning_progress_user_id ON learning_progress (user_id);
