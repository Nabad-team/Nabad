function selectCases(cases, args) {
  const value = (flag) => {
    const index = args.indexOf(flag);
    if (index < 0) return undefined;
    const result = args[index + 1];
    if (!result || result.startsWith("--")) throw new Error(`Provide a value for ${flag}.`);
    return result;
  };
  const caseId = value("--case");
  const suite = value("--suite") || (caseId ? "all" : "baseline");
  if (!["baseline", "advanced", "healthbench", "all"].includes(suite)) throw new Error("Choose baseline, advanced, healthbench or all for --suite.");
  let selected = cases.filter((entry) => (suite === "all" || entry.suite === suite) && (!caseId || entry.id === caseId));
  if (!selected.length) throw new Error("No evaluation cases matched the selected suite and case.");
  const limit = value("--limit");
  if (limit !== undefined) {
    if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > cases.length) throw new Error(`Choose a --limit between 1 and ${cases.length}.`);
    selected = selected.slice(0, Number(limit));
  }
  return selected;
}
module.exports = { selectCases };
