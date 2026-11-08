import Head from "next/head";
import { isStaging } from "../lib/appEnvironment";

// On staging and PR previews only: a strip on top of every page saying the data is not real, and a robots tag so the
// pages stay out of search results (next.config.js also sends X-Robots-Tag). Production renders nothing.
export default function StagingBanner() {
  if (!isStaging()) return null;
  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" key="robots" />
      </Head>
      <div className="staging-banner" role="region" aria-label="Staging environment">
        <strong>Staging: test data only.</strong> Do not enter real health information.
      </div>
    </>
  );
}
