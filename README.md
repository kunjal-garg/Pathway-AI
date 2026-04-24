# PathwayAI

PathwayAI is a single-page web app that guides users from a marketing-style landing page through profile setup, optional resume parsing, a role-based interview assessment, and a learning dashboard with per-skill modules. Everything runs in the browser (no backend required for the core flow).

## Quick start

1. Clone or download this repository.
2. From the project root, start a local static server (required so assets like PDF.js workers and the assessment bank script load reliably):

   ```bash
   ./serve.sh
   ```

3. Open the URL printed in the terminal (defaults to `http://127.0.0.1:9000/pathwayai.html`).  
   You can also open `http://127.0.0.1:9000/` — `index.html` redirects to `pathwayai.html`.

Opening `pathwayai.html` directly from disk (`file://`) may break script loading or PDF features; use a local server.

## What’s in the repo

| Path | Purpose |
|------|--------|
| `pathwayai.html` | Main application: UI, navigation, resume upload/parse, goals, assessment UI, dashboard, module learning screen, and app logic. |
| `pathwayai-assessment-banks.js` | Large `INTERVIEW_BANKS` object: role-matched MCQ/code questions with `correct` indices. Loaded before the main script in `pathwayai.html`. |
| `serve.sh` | Finds a free port (from `PORT`, default `9000`) and runs `python3 -m http.server`. |
| `index.html` | Short redirect to `pathwayai.html`. |
| `vendor/pdf.min.mjs`, `vendor/pdf.worker.min.mjs` | PDF.js (referenced from `pathwayai.html` for resume parsing). |

## User flow (high level)

1. **Landing** — Sign-in / entry into the app.  
2. **Goals** — Role, industry, timeline, companies, etc.  
3. **Resume / profile** — Optional PDF resume or manual profile; data feeds skill signals.  
4. **Assessment** (optional) — Fifteen questions drawn from a shuffled bank matched to the user’s role; answers are scored and blended with resume-based scores.  
5. **Dashboard** — Skill bars, readiness ring, priority module cards with lesson progress.  
6. **Module learning** — Full-screen lessons per module (YouTube search links, resources, practice tasks, completion tracking).

## Local persistence

The app uses `localStorage` for session-like data (examples; not exhaustive):

- `pathwayai_role`, `pathwayai_prelimScores` — Role and resume-derived domain scores.  
- `pathwayai_examScore` — Percentage score from the last completed assessment.  
- `pathwayai_moduleProgress` — Completed lesson indices per module name.  
- `pathwayai_moduleSkillBoost` — One-time +15 display boost per fully completed module.  
- Assessment payloads under keys such as `pathwayai_assessment_v1_*` (see `pathwayai.html` for the exact key pattern).

Clearing site data for the origin resets this state.

## Development notes

- **Assessment**: Question selection uses a Fisher–Yates shuffle on the active bank, then takes 15 questions. Banks are keyed by role (e.g. `swe`, `pm`, `dataanalyst`, `generic`).  
- **Styling**: Self-contained CSS in `pathwayai.html`; code blocks in the assessment use a GitHub-style dark theme and light syntax highlighting.  
- **Dependencies**: PDF.js and JSZip are loaded from CDN URLs declared in `pathwayai.html`; vendor copies exist under `vendor/` for worker configuration.

## License

If you add a license file (e.g. MIT), describe it here. Until then, treat usage as defined by the repository owner.
