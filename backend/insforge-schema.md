# InsForge / Postgres schema — PathwayAI

Tables below are the source of truth for `migrations/001_initial.sql`.

## `users`

| Column | Type | Constraints |
|--------|------|---------------|
| `id` | `uuid` | `PRIMARY KEY`, default `gen_random_uuid()` |
| `email` | `text` | `UNIQUE` |
| `name` | `text` | nullable |
| `display_name` | `text` | nullable |
| `role` | `text` | nullable (job role, e.g. from onboarding) |
| `industry` | `text` | nullable |
| `created_at` | `timestamptz` | `NOT NULL`, default `now()` |
| `updated_at` | `timestamptz` | `NOT NULL`, default `now()` |

## `resumes`

| Column | Type | Constraints |
|--------|------|---------------|
| `id` | `uuid` | `PRIMARY KEY`, default `gen_random_uuid()` |
| `user_id` | `uuid` | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` |
| `file_url` | `text` | nullable |
| `storage_key` | `text` | nullable |
| `raw_text` | `text` | nullable |
| `parsed_name` | `text` | nullable |
| `parsed_email` | `text` | nullable |
| `skills` | `jsonb` | `NOT NULL`, default `'[]'` (string array) |
| `education` | `jsonb` | `NOT NULL`, default `'[]'` |
| `experience` | `jsonb` | `NOT NULL`, default `'[]'` |
| `created_at` | `timestamptz` | `NOT NULL`, default `now()` |
| `updated_at` | `timestamptz` | `NOT NULL`, default `now()` |

## `job_profiles`

| Column | Type | Constraints |
|--------|------|---------------|
| `id` | `uuid` | `PRIMARY KEY`, default `gen_random_uuid()` |
| `user_id` | `uuid` | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` |
| `job_url` | `text` | nullable |
| `job_title` | `text` | nullable |
| `company` | `text` | nullable |
| `profile` | `jsonb` | `NOT NULL`, default `'{}'` (e.g. TinyFish / service payload: `requiredSkills`, `preferredSkills`, `responsibilities`, …) |
| `created_at` | `timestamptz` | `NOT NULL`, default `now()` |
| `updated_at` | `timestamptz` | `NOT NULL`, default `now()` |

## `gap_reports`

| Column | Type | Constraints |
|--------|------|---------------|
| `id` | `uuid` | `PRIMARY KEY`, default `gen_random_uuid()` |
| `user_id` | `uuid` | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` |
| `job_profile_id` | `uuid` | `REFERENCES job_profiles(id) ON DELETE SET NULL` |
| `match_score` | `integer` | nullable |
| `final_score` | `integer` | nullable |
| `report` | `jsonb` | `NOT NULL`, default `'{}'` (full `analyze-gap` response) |
| `created_at` | `timestamptz` | `NOT NULL`, default `now()` |

## `assessments`

| Column | Type | Constraints |
|--------|------|---------------|
| `id` | `uuid` | `PRIMARY KEY`, default `gen_random_uuid()` |
| `user_id` | `uuid` | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` |
| `role` | `text` | nullable |
| `industry` | `text` | nullable |
| `answers` | `jsonb` | `NOT NULL`, default `'[]'` (e.g. selected option indices) |
| `score` | `integer` | nullable (0–100) |
| `readiness` | `integer` | nullable |
| `payload` | `jsonb` | `NOT NULL`, default `'{}'` (optional full dashboard seed / skills) |
| `created_at` | `timestamptz` | `NOT NULL`, default `now()` |
| `updated_at` | `timestamptz` | `NOT NULL`, default `now()` |

## `learning_progress`

| Column | Type | Constraints |
|--------|------|---------------|
| `id` | `uuid` | `PRIMARY KEY`, default `gen_random_uuid()` |
| `user_id` | `text` | `NOT NULL` (aligns with `/api/save-progress` string `userId` — email, temp id, or uuid string) |
| `module_id` | `text` | `NOT NULL` |
| `lesson_index` | `integer` | `NOT NULL`, default `0` |
| `completed` | `boolean` | `NOT NULL`, default `false` |
| `updated_at` | `timestamptz` | `NOT NULL`, default `now()` |

**Unique:** `(user_id, module_id, lesson_index)`.

**Index:** `btree` on `(user_id)`.

---

**Note:** This file was empty when migrations were first added; the definitions above are the contract for the initial SQL migration.
