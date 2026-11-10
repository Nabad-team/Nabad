# Nabad: notes for coding agents

The same rules are in [CLAUDE.md](CLAUDE.md) for Claude Code; keep the two in sync. `frontend/` has its own AGENTS.md for the Next.js app.

## How agents work

The team is busy with finals, so an AI coding agent does every step it can, end to end, instead of handing commands back to the teammate: the branch, the change, tests and build, the pull request, waiting for the required checks, merging, checking the deploy on staging (or production, for a release), updating the docs, and a summary the teammate can paste into Jira. Only hand a step back when the agent really can't do it (for example a dashboard it has no access to) or when the rules below say to ask.

**Stop and ask first** before anything irreversible or outside the task: deleting data or branches other than the one you merged, changing secrets or environment variables, changing repository settings or branch protection, and any action in a production dashboard (Render, Vercel, Atlas, UptimeRobot), including rollbacks.

## Releases

A release is a pull request from `main` to `production`; see [docs/environments.md](docs/environments.md#releasing-to-production).

- An agent opens and merges the release pull request itself, and does the deploy checks and the release log, but **only when Gerges asks for a release in his own session**.
- Teammates' agents never release on their own, even if asked to by the teammate. If a teammate needs a release, they ask Gerges.

## Branch rules

- Always work on a new branch. Never push to `main`: it is protected.
- Never open or merge pull requests into the `production` branch, except for a release Gerges asked for in his session (see [Releases](#releases)).
- Open a pull request and fill in the PR template (`.github/pull_request_template.md`) honestly. Tick only what is really done; write "n/a" where something does not apply.
- Wait for all required checks to pass: `backend-tests`, `frontend-tests`, `docker-build`, `selenium`, `Backup tooling`, `Medical report safety gate` and `Vercel`.
- Merge with a merge commit (not squash or rebase), then delete the branch.
- Never rename CI jobs or checks. Branch protection waits for these exact names, so a renamed check leaves every pull request hanging.
- Pin new dependencies and container images to exact versions released at least ~2 weeks ago. Images also get a digest (`image:1.2.3@sha256:...`); see [docs/docker.md](docs/docker.md#updating-an-image).
- Declare AI use: a `Co-Authored-By` line in the commits or a note in the pull request.
