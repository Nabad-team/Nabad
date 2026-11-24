# Fetches every pull_request workflow run and all its job attempts. Writes runs.json and jobs.json.
import json, subprocess, sys, os
OUT = sys.argv[1]
def gh(path):
    r = subprocess.run(["gh", "api", "--paginate", path], capture_output=True, text=True, encoding="utf-8")
    if r.returncode: raise SystemExit(r.stderr)
    # --paginate concatenates JSON objects; split them
    dec, s, i, objs = json.JSONDecoder(), r.stdout, 0, []
    while i < len(s):
        while i < len(s) and s[i].isspace(): i += 1
        if i >= len(s): break
        o, i = dec.raw_decode(s, i); objs.append(o)
    return objs
runs = [run for page in gh("repos/Nabad-team/Nabad/actions/runs?event=pull_request&per_page=100") for run in page["workflow_runs"]]
slim = [{k: r.get(k) for k in ("id","name","head_sha","head_branch","run_attempt","conclusion","status","created_at")} | {"prs":[p["number"] for p in r.get("pull_requests") or []]} for r in runs]
json.dump(slim, open(os.path.join(OUT,"runs.json"),"w"))
jobs = []
for n, r in enumerate(slim):
    for page in gh(f"repos/Nabad-team/Nabad/actions/runs/{r['id']}/jobs?filter=all&per_page=100"):
        for j in page["jobs"]:
            jobs.append({"run": r["id"], "workflow": r["name"], "head_sha": r["head_sha"], "branch": r["head_branch"], "prs": r["prs"],
                         "name": j["name"], "attempt": j.get("run_attempt"), "conclusion": j["conclusion"], "started": j["started_at"]})
    if n % 100 == 0: print(n, len(jobs), flush=True)
json.dump(jobs, open(os.path.join(OUT,"jobs.json"),"w"))
print("done", len(slim), "runs", len(jobs), "jobs")
