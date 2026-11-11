// TEMPORARY: remove in the client-IP fix pull request. On staging only, for requests that carry the header
// "X-Nabad-Ip-Diagnostic: 1", logs which addresses the API sees, so we can set TRUST_PROXY to the real number of
// proxy hops between the visitor and the API (Vercel, Render). Only the team's own test requests send that header.
// IP addresses only: anything in these headers that is not an IP address is logged as "not-an-ip".
const net = require("node:net");

const HEADER = "x-nabad-ip-diagnostic";
const IP_HEADERS = ["x-forwarded-for", "x-real-ip", "x-vercel-forwarded-for", "cf-connecting-ip", "true-client-ip"];

const onlyIp = (value) => {
  const text = String(value).trim().replace(/^::ffff:/, "");
  return net.isIP(text) ? text : "not-an-ip";
};
const ipList = (value) => (value === undefined ? undefined : String(value).split(",").slice(0, 10).map(onlyIp));

function ipDiagnostic(environment, trustProxy, write = (line) => process.stdout.write(line + "\n")) {
  return (req, res, next) => {
    if (environment === "staging" && req.get(HEADER) === "1") {
      const headers = {};
      for (const name of IP_HEADERS) {
        const list = ipList(req.get(name));
        if (list) headers[name] = list;
      }
      write(JSON.stringify({
        time: new Date().toISOString(), event: "ip_diagnostic", trustProxy,
        ip: onlyIp(req.ip), ips: req.ips.slice(0, 10).map(onlyIp), socket: onlyIp(req.socket?.remoteAddress || ""), headers,
      }));
    }
    next();
  };
}

module.exports = { ipDiagnostic, HEADER };
