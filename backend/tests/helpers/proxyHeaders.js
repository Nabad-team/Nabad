// Requests "from" a given visitor IP, the way our Next.js proxy sends them (src/clientIp.js): the shared secret plus
// X-Nabad-Client-IP. Tests that need many visitors set API_PROXY_SECRET to TEST_PROXY_SECRET before creating the app.
const TEST_PROXY_SECRET = "test-only-api-proxy-secret-".padEnd(64, "0");
const asVisitor = (ip) => ({ "X-Nabad-Proxy-Secret": TEST_PROXY_SECRET, "X-Nabad-Client-IP": ip });
module.exports = { TEST_PROXY_SECRET, asVisitor };
