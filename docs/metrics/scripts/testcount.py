# Static test counts at a commit: test(/it( calls in backend tests, frontend __tests__, and def test_ in Python e2e.
import subprocess, sys, re
def files(commit, prefix):
    r = subprocess.run(["git","ls-tree","-r","--name-only",commit,"--",prefix], capture_output=True, text=True)
    return [f for f in r.stdout.split() if "node_modules" not in f]
def show(commit, f):
    return subprocess.run(["git","show",f"{commit}:{f}"], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
def count(commit):
    js = re.compile(r"^\s*(?:test|it)(?:\.each\([^)]*\))?\s*\(", re.M)
    be = sum(len(js.findall(show(commit,f))) for f in files(commit,"backend/tests") if f.endswith((".js",".cjs")))
    fe = sum(len(js.findall(show(commit,f))) for f in files(commit,"frontend/__tests__") if f.endswith((".js",".jsx",".ts",".tsx")))
    py = sum(len(re.findall(r"^\s*def test_", show(commit,f), re.M)) for f in files(commit,"tests") if f.endswith(".py"))
    return be, fe, py
if __name__ == "__main__":
    for c in sys.argv[1:]: print(c, *count(c))
