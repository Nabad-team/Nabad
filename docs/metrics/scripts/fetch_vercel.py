# For each PR merged into main: the official Vercel (nabad3) status history on its final commit.
import json, subprocess, sys
OUT = sys.argv[1]
prs = [p for p in json.load(open(OUT + "/prs.json")) if p["baseRefName"] == "main"]
res = {}
for p in prs:
    r = subprocess.run(["gh","api","--paginate",f"repos/Nabad-team/Nabad/commits/{p['headRefOid']}/statuses?per_page=100"], capture_output=True, text=True, encoding="utf-8")
    try: sts = json.loads(r.stdout) if r.stdout.strip().startswith("[") else []
    except Exception: sts = []
    v = [s for s in sts if s.get("context") == "Vercel" and "nabad3" in (s.get("target_url") or "")]
    res[p["number"]] = [{"state": s["state"], "at": s["created_at"]} for s in v]
json.dump(res, open(OUT + "/vercel.json", "w"))
print("done", len(res), sum(1 for v in res.values() if v))
