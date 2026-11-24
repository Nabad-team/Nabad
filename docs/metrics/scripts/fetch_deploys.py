# Production deployment records with their latest status and URL, to separate nabad-psi (official) from other projects.
import json, subprocess, sys
OUT = sys.argv[1]
def gh(path):
    r = subprocess.run(["gh","api","--paginate",path], capture_output=True, text=True, encoding="utf-8")
    dec, s, i, objs = json.JSONDecoder(), r.stdout, 0, []
    while i < len(s):
        while i < len(s) and s[i].isspace(): i += 1
        if i >= len(s): break
        o, i = dec.raw_decode(s, i); objs.append(o)
    return objs
deps = [d for page in gh("repos/Nabad-team/Nabad/deployments?per_page=100") for d in page if d["environment"] in ("Production", "main - nabad-backend-nhv5")]
out = []
for d in deps:
    sts = [s for page in gh(f"repos/Nabad-team/Nabad/deployments/{d['id']}/statuses?per_page=100") for s in page]
    final = sts[0] if sts else {}
    out.append({"env": d["environment"], "created": d["created_at"], "sha": d["sha"], "ref": d["ref"], "creator": d["creator"]["login"],
                "state": final.get("state"), "url": final.get("environment_url") or final.get("target_url") or ""})
json.dump(out, open(OUT + "/prod_deploys.json", "w"))
print("done", len(out))
