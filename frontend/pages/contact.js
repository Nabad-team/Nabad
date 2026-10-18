import PageLayout, { CONTACT_EMAIL } from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Alert from "../components/ui/Alert";

// How to reach the team. Public: linked from the footer. The address is CONTACT_EMAIL in PageLayout.
export default function ContactPage() {
  return (
    <PageLayout title="Contact">
      <PageTitle lead="Questions, feedback or something not working? We'd like to hear from you.">
        Contact us
      </PageTitle>

      <Alert tone="danger" title="This is not for medical help." className="page-alert">
        <p>The team can&apos;t answer health questions. In an emergency, call 140.</p>
      </Alert>

      <h2>Email the team</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <h2 id="report-a-problem">Report a problem</h2>
      <p>
        If something looks wrong or doesn&apos;t work, email us with the page you were on, what you did and what
        happened. A screenshot helps. Please don&apos;t include passwords or health details.
      </p>
    </PageLayout>
  );
}
