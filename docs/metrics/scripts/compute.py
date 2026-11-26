# Computes the process metrics from the fetched GitHub data. Usage: python -I compute.py <metrics dir> <repo dir>
# Writes metrics.json and prints a summary. Sprint dates from Gerges (Jira): two-week sprints, a PR merged on a
# boundary day counts in the sprint that ends that day. Dates are Beirut dates.
import json, os, subprocess, sys, statistics, datetime as dt
from zoneinfo import ZoneInfo

D, REPO = sys.argv[1], sys.argv[2]
BEIRUT = ZoneInfo("Asia/Beirut")
NOW = dt.datetime(2026, 11, 26, 13, 0, tzinfo=dt.timezone.utc)  # snapshot time for "so far"
T = lambda s: dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
day = lambda t: t.astimezone(BEIRUT).date()
SPRINTS = [  # name, first day, last day (inclusive, Beirut)
    ("Sprint 1", dt.date(2026, 9, 22), dt.date(2026, 10, 6)),
    ("Sprint 2", dt.date(2026, 10, 7), dt.date(2026, 10, 20)),
    ("Sprint 3", dt.date(2026, 10, 21), dt.date(2026, 11, 3)),
    ("Sprint 4", dt.date(2026, 11, 4), dt.date(2026, 11, 17)),
    ("Sprint 5", dt.date(2026, 11, 18), dt.date(2026, 12, 1)),
]
def sprint_of(t):
    d = day(t)
    for name, a, b in SPRINTS:
        if a <= d <= b: return name
    return None
def weeks(name):
    _, a, b = next(s for s in SPRINTS if s[0] == name)
    end = min(b, day(NOW))
    return ((end - a).days + 1) / 7
def med(xs): return round(statistics.median(xs), 1) if xs else None
def git(*a): return subprocess.run(["git", *a], cwd=REPO, capture_output=True, text=True).stdout.strip()

prs = json.load(open(os.path.join(D, "prs.json"), encoding="utf-8"))
main = sorted([p for p in prs if p["baseRefName"] == "main"], key=lambda p: p["mergedAt"])
rel = sorted([p for p in prs if p["baseRefName"] == "production"], key=lambda p: p["mergedAt"])
names = [s[0] for s in SPRINTS]
out = {"snapshot": NOW.isoformat(), "sprints": [{"name": n, "from": str(a), "to": str(b)} for n, a, b in SPRINTS]}

# 1. Merged PRs, and 2. median hours from opened to merged (PRs into main; release PRs listed apart).
minutes = lambda p: (T(p["mergedAt"]) - T(p["createdAt"])).total_seconds() / 60
out["merged_prs"] = {"project": {"main": len(main), "release": len(rel)}}
q = lambda xs, f: round(sorted(xs)[int(f * len(xs))], 1) if xs else None
out["pr_cycle_minutes"] = {"project": {"median": med([minutes(p) for p in main]), "p75": q([minutes(p) for p in main], 0.75), "p90": q([minutes(p) for p in main], 0.9), "under_2_min": sum(minutes(p) < 2 for p in main), "n": len(main)}}
for n in names:
    m = [p for p in main if sprint_of(T(p["mergedAt"])) == n]
    r = [p for p in rel if sprint_of(T(p["mergedAt"])) == n]
    out["merged_prs"][n] = {"main": len(m), "release": len(r)}
    out["pr_cycle_minutes"][n] = {"median": med([minutes(p) for p in m]), "p75": q([minutes(p) for p in m], 0.75), "p90": q([minutes(p) for p in m], 0.9), "under_2_min": sum(minutes(p) < 2 for p in m), "n": len(m)}

# 3. Deployment frequency: formal releases (PRs into production) per week, and actual production deploys of the
# official app (successful Vercel "Production" records on nabad-psi / nabad3) per week.
deps = json.load(open(os.path.join(D, "prod_deploys.json")))
psi = [d for d in deps if d["env"] == "Production" and d["state"] == "success" and ("nabad-psi" in d["url"] or "nabad3" in d["url"])]
other = [d for d in deps if d["env"] == "Production" and d not in psi]
nhv5 = [d for d in deps if d["env"] == "main - nabad-backend-nhv5" and d["state"] == "success"]
# Weeks since the first deploy record (12 October); earlier production deploys were manual and left no record.
project_weeks = ((day(NOW) - min(day(T(d["created"])) for d in psi)).days + 1) / 7
release_weeks = ((day(NOW) - day(T(rel[0]["mergedAt"]))).days + 1) / 7
out["deploy_frequency"] = {"project": {
    "releases": len(rel), "releases_per_week_since_first": round(len(rel) / release_weeks, 1),
    "frontend_prod_deploys": len(psi), "frontend_prod_deploys_per_week": round(len(psi) / project_weeks, 1),
    "first_frontend_prod_deploy": min((d["created"] for d in psi), default=None),
    "backend_deploy_records": len(nhv5), "other_production_records_excluded": len(other)}}
for n in names:
    w = weeks(n)
    r = [p for p in rel if sprint_of(T(p["mergedAt"])) == n]
    f = [d for d in psi if sprint_of(T(d["created"])) == n]
    out["deploy_frequency"][n] = {"weeks": round(w, 1), "releases": len(r), "releases_per_week": round(len(r) / w, 1),
                                  "frontend_prod_deploys": len(f), "frontend_prod_deploys_per_week": round(len(f) / w, 1)}

# 4. Lead time from merge to main until in production.
#   Release era (from the staging cutover, PR #196): time until the release PR whose merge commit contains it.
#   Before: main deployed production on every push, so the time until the first successful nabad-psi Production
#   deploy of a commit that contains the PR.
cutover = T(next(p for p in prs if p["number"] == 196)["mergedAt"])
anc = lambda a, b: subprocess.run(["git", "merge-base", "--is-ancestor", a, b], cwd=REPO).returncode == 0
psi_sorted = sorted(psi, key=lambda d: d["created"])
lead = []
for p in main:
    m = T(p["mergedAt"]); sha = p["mergeCommit"]["oid"]
    if m >= cutover:
        r = next((r for r in rel if T(r["mergedAt"]) >= m and anc(sha, r["mergeCommit"]["oid"])), None)
        if r: lead.append({"pr": p["number"], "era": "release", "hours": (T(r["mergedAt"]) - m).total_seconds() / 3600, "sprint": sprint_of(m)})
    else:
        d = next((d for d in psi_sorted if T(d["created"]) >= m and git("cat-file", "-t", d["sha"]) == "commit" and anc(sha, d["sha"])), None)
        # No GitHub record exists for production deploys before Vercel was connected to Git (manual CLI deploys).
        if m < T(psi_sorted[0]["created"]): continue
        if d and T(d["created"]) < cutover + dt.timedelta(hours=1):
            lead.append({"pr": p["number"], "era": "auto", "hours": (T(d["created"]) - m).total_seconds() / 3600, "sprint": sprint_of(m)})
out["lead_time_hours"] = {"project": {"median": med([x["hours"] for x in lead]), "n": len(lead),
    "median_release_era": med([x["hours"] for x in lead if x["era"] == "release"]), "n_release_era": sum(x["era"] == "release" for x in lead),
    "median_auto_era": med([x["hours"] for x in lead if x["era"] == "auto"]), "median_auto_era_minutes": med([x["hours"] * 60 for x in lead if x["era"] == "auto"]),
    "p90_all": q([x["hours"] for x in lead], 0.9), "p90_release_era": (sorted(x["hours"] for x in lead if x["era"] == "release")[int(0.9 * sum(x["era"] == "release" for x in lead))] if any(x["era"] == "release" for x in lead) else None), "n_auto_era": sum(x["era"] == "auto" for x in lead),
    "not_measured": len(main) - len(lead)}}
for n in names:
    xs = [x["hours"] for x in lead if x["sprint"] == n]
    out["lead_time_hours"][n] = {"median": med(xs), "p90": q(xs, 0.9), "median_release_era": med([x["hours"] for x in lead if x["sprint"] == n and x["era"] == "release"]), "p90_release_era": q([x["hours"] for x in lead if x["sprint"] == n and x["era"] == "release"], 0.9), "n": len(xs), "not_measured": sum(sprint_of(T(p["mergedAt"])) == n for p in main) - len(xs)}

# 5. Change failure rate (judged by hand, see process.md): literal = a later release within 48 h shipped a fix
# PR; attributed = that fix repaired something the earlier release introduced. #273 is too recent to judge.
judged = {197: (True, False, "#202 (47.9 h later, in #203): CI fixes and an undefined colour token from before"),
          203: (True, False, "#208, #209 (13 h later, in #210): rate limits used a proxy IP since before this release"),
          210: (False, False, "next release 101 h later"), 236: (False, False, "#238 is a feature"), 239: (False, False, "#241 is a feature"),
          242: (False, False, "#244 is a feature"), 245: (False, False, "#247 is a feature"),
          248: (True, False, "#250 (25 min later, in #251): notification texts from the notifications feature, Sprint 3"),
          251: (False, False, "next release 8 days later"),
          261: (False, False, "#266 (10.5 h later) shipped Held refresh phases 1 and 2 (#264, #265): features"),
          266: (False, False, "#273 (9.8 h later) shipped Held refresh phases 3 to 3.2 (#270 to #272): design work, no fix/ PR")}
out["change_failure"] = {"project": {"judged": len(judged), "literal": sum(v[0] for v in judged.values()), "attributed": sum(v[1] for v in judged.values()),
                                     "rollbacks": 0, "reverts": 0, "too_recent": [273]},
                         "releases": {str(k): {"literal": v[0], "attributed": v[1], "note": v[2]} for k, v in judged.items()}}
for n in names:
    ks = [p["number"] for p in rel if sprint_of(T(p["mergedAt"])) == n and p["number"] in judged]
    out["change_failure"][n] = {"judged": len(ks), "literal": sum(judged[k][0] for k in ks), "attributed": sum(judged[k][1] for k in ks)}

# 6. CI pass rate of the required checks on pull requests. Actions jobs: every attempt, success / (success +
# failure + timed out); cancelled and skipped runs are left out. Vercel: final state on each merged PR's last commit.
REQUIRED = {"backend-tests", "frontend-tests", "docker-build", "selenium", "Backup tooling", "Medical report safety gate"}
jobs = [j for j in json.load(open(os.path.join(D, "jobs.json"))) if j["name"] in REQUIRED and j["conclusion"] in ("success", "failure", "timed_out") and j["started"]]
def rate(js): return {"runs": len(js), "passed": sum(j["conclusion"] == "success" for j in js), "rate": round(100 * sum(j["conclusion"] == "success" for j in js) / len(js), 1) if js else None}
out["ci_pass_rate"] = {"project": rate(jobs) | {"by_check": {k: rate([j for j in jobs if j["name"] == k]) for k in sorted(REQUIRED)}}}
for n in names: out["ci_pass_rate"][n] = rate([j for j in jobs if sprint_of(T(j["started"])) == n])
vercel = json.load(open(os.path.join(D, "vercel.json")))
final = {int(k): sorted(v, key=lambda s: s["at"])[-1]["state"] for k, v in vercel.items() if v}
final = {k: s for k, s in final.items() if s in ("success", "failure", "error")}
out["ci_pass_rate"]["project"]["vercel_final_commit"] = {"prs": len(final), "passed": sum(s == "success" for s in final.values())}
# First-time-green: share of merged PRs whose final commit passed every required job on the first attempt.
by_sha = {}
for j in json.load(open(os.path.join(D, "jobs.json"))):
    if j["name"] in REQUIRED: by_sha.setdefault(j["head_sha"], []).append(j)
ftg = []
for p in main:
    js = by_sha.get(p["headRefOid"], [])
    first = [j for j in js if j.get("attempt") == 1 and j["conclusion"] in ("success", "failure", "timed_out")]
    if first: ftg.append((sprint_of(T(p["mergedAt"])), all(j["conclusion"] == "success" for j in first)))
out["ci_first_time_green"] = {"project": {"prs": len(ftg), "green": sum(g for _, g in ftg)}}
for n in names:
    xs = [g for s, g in ftg if s == n]
    out["ci_first_time_green"][n] = {"prs": len(xs), "green": sum(xs)}

# 7. Test counts: static count of test cases (test()/it() in backend and frontend, def test_ in Python e2e) at the
# first commit with tests and at the end of each sprint; runtime counts now from the last full runs.
sys.path.insert(0, D)
from testcount import count
first = git("log", "--reverse", "--format=%H", "origin/main", "--", "backend/tests", "frontend/__tests__", "tests").splitlines()[0]
tc = {"first": {"commit": first[:7], "date": git("log", "-1", "--format=%ad", "--date=short", first), "counts": count(first)}}
for n, a, b in SPRINTS:
    end = dt.datetime.combine(min(b, day(NOW)), dt.time(23, 59, 59), BEIRUT)
    c = git("rev-list", "-1", f"--before={end.isoformat()}", "origin/main")
    tc[n] = {"commit": c[:7], "counts": count(c)}
tc["runtime_now"] = {"backend": 1404, "frontend": 1055, "note": "CI run 45466997442 on main 7ffd606 (24 Nov): backend-tests and frontend-tests jobs"}
out["test_counts"] = tc

# 8. First-run pass share per required check: for each (check, commit) on a PR, did attempt 1 pass?
allj = json.load(open(os.path.join(D, "jobs.json")))
first_runs = {}
for j in allj:
    if j["name"] in REQUIRED and j.get("attempt") == 1 and j["conclusion"] in ("success", "failure", "timed_out"):
        first_runs[(j["name"], j["head_sha"])] = j["conclusion"] == "success"
out["ci_first_run_by_check"] = {k: {"commits": sum(1 for (c, _) in first_runs if c == k),
                                    "passed_first_run": sum(v for (c, _), v in first_runs.items() if c == k)} for k in sorted(REQUIRED)}
for k, v in out["ci_first_run_by_check"].items(): v["rate"] = round(100 * v["passed_first_run"] / v["commits"], 1) if v["commits"] else None

# 9. CI duration. Per job: started to completed of every required job attempt that finished. Per commit: from the
# first required job's start to the last one's completion, on the first attempt (the wall time a PR author waits).
dur = lambda j: (T(j["completed"]) - T(j["started"])).total_seconds() / 60
done = [j for j in allj if j["name"] in REQUIRED and j.get("completed") and j["started"] and j["conclusion"] in ("success", "failure", "timed_out")]
walls = {}
for j in done:
    if j.get("attempt") != 1: continue
    a, b = walls.get(j["head_sha"], (None, None))
    s0, e0 = T(j["started"]), T(j["completed"])
    walls[j["head_sha"]] = (min(a, s0) if a else s0, max(b, e0) if b else e0)
wall_by_sprint = {}
for sha, (a, b) in walls.items(): wall_by_sprint.setdefault(sprint_of(a), []).append((b - a).total_seconds() / 60)
out["ci_duration_minutes"] = {"project": {"per_commit_median": med([x for xs in wall_by_sprint.values() for x in xs]),
                                          "per_commit_p90": q([x for xs in wall_by_sprint.values() for x in xs], 0.9), "commits": len(walls),
                                          "by_check_median": {k: med([dur(j) for j in done if j["name"] == k]) for k in sorted(REQUIRED)}}}
for n in names: out["ci_duration_minutes"][n] = {"per_commit_median": med(wall_by_sprint.get(n, [])), "commits": len(wall_by_sprint.get(n, []))}

# 10. Throughput per author (GitHub handle) and sprint, PRs into main.
authors = sorted({p["author"]["login"] for p in main})
out["throughput_by_author"] = {a: {n: sum(1 for p in main if p["author"]["login"] == a and sprint_of(T(p["mergedAt"])) == n) for n in names} for a in authors}
for a in authors: out["throughput_by_author"][a]["total"] = sum(1 for p in main if p["author"]["login"] == a)

# 11. AI use declared: the PR description ticks "AI use declared" or names an AI tool, or a commit in the PR has a
# Co-Authored-By line naming one. Commits of a PR = merge commit's second parent back to the first parent.
import re
AI = re.compile(r"co-authored-by|claude code|codex|copilot|chatgpt|generated with|\bAI[- ](assist\w*|agent\w*|tool\w*|use|written|generated)\b|(written|drafted|made) (with|by) (an )?AI\b", re.I)
def declared(p):
    body = p.get("body") or ""
    if re.search(r"\[x\]\s*AI use declared", body, re.I): return "ticked"
    if AI.search(body): return "body"
    m = p["mergeCommit"]["oid"]
    msgs = git("log", "--format=%B", f"{m}^1..{m}^2")
    if re.search(r"co-authored-by:.*(claude|codex|copilot|openai|chatgpt|gemini|cursor|noreply@anthropic)", msgs, re.I): return "commit"
    return None
ai = {p["number"]: declared(p) for p in main}
out["ai_declared"] = {"project": {"prs": len(main), "declared": sum(1 for v in ai.values() if v), "by_how": {h: sum(1 for v in ai.values() if v == h) for h in ("ticked", "body", "commit")}}}
for n in names:
    ps = [p for p in main if sprint_of(T(p["mergedAt"])) == n]
    out["ai_declared"][n] = {"prs": len(ps), "declared": sum(1 for p in ps if ai[p["number"]])}

json.dump(out, open(os.path.join(D, "metrics.json"), "w"), indent=1)
print(json.dumps(out, indent=1)[:6000])
