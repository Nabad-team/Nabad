import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Button from "../components/ui/Button";
import { useSignedIn } from "../components/SessionTimeout";

// Shown for any address that doesn't match a page.
export default function NotFoundPage() {
  const signedIn = useSignedIn();
  return (
    <PageLayout title="Page not found">
      <PageTitle lead="The link may be old, or the address may have a typo. Let's get you back on track.">
        We couldn't find that page
      </PageTitle>
      {signedIn ? <Button href="/dashboard">Go to your dashboard</Button> : <Button href="/">Go to the home page</Button>}
    </PageLayout>
  );
}
