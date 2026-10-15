import messages from "../locales/en/providers.json";
// Namespaced message keys, ready for the team's planned Arabic/French translation layer.
export function providerText(key, values = {}) {
  const message = key.split(".").reduce((value, part) => value?.[part], messages);
  return (typeof message === "string" ? message : key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
}
