# Nabad: notes for coding agents

The same rules are in [CLAUDE.md](CLAUDE.md) for Claude Code; keep the two in sync. `frontend/` has its own AGENTS.md for the Next.js app.

## Branch rules

- Always work on a new branch. Never push to `main`: it is protected.
- Open a pull request and fill in the PR template (`.github/pull_request_template.md`) honestly. Tick only what is really done; write "n/a" where something does not apply.
- Wait for all required checks to pass: `backend-tests`, `frontend-tests`, `docker-build`, `selenium`, `Backup tooling`, `Medical report safety gate` and `Vercel`.
- Merge with a merge commit (not squash or rebase), then delete the branch.
- Never rename CI jobs or checks. Branch protection waits for these exact names, so a renamed check leaves every pull request hanging.
- Pin new dependencies and container images to exact versions released at least ~2 weeks ago. Images also get a digest (`image:1.2.3@sha256:...`); see [docs/docker.md](docs/docker.md#updating-an-image).
- Declare AI use: a `Co-Authored-By` line in the commits or a note in the pull request.
