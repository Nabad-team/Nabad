// Which deployment this build is (docs/environments.md). Staging is main's stable URL and every PR preview: they use
// the staging backend and hold test data only, so they show a banner and ask search engines not to index them.
// Production (the "production" branch) and local development are never staging.
//   NEXT_PUBLIC_APP_ENV:    "staging" on Vercel's Preview environment.
//   NEXT_PUBLIC_VERCEL_ENV: set by Vercel; "preview" also counts, so a forgotten variable still shows the banner.
// The process.env reads are written out in full: Next.js only inlines NEXT_PUBLIC_ values written that way.
// CommonJS, because next.config.js uses it too.
function isStaging(appEnv = process.env.NEXT_PUBLIC_APP_ENV, vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV) {
  return appEnv === "staging" || vercelEnv === "preview";
}

module.exports = { isStaging };
