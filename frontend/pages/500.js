import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Button from "../components/ui/Button";
import { useSignedIn } from "../components/SessionTimeout";

// Shown when a page fails on the server.
export default function ServerErrorPage() {
  const signedIn = useSignedIn();
  return (
    <PageLayout title="Something went wrong">
      <PageTitle lead="It's a problem on our side, not something you did. Please try again in a moment.">
        Something went wrong
      </PageTitle>
      <p>
        If it keeps happening, <a href="/contact">let us know</a>. In an emergency, call 140.
      </p>
      {signedIn ? <Button href="/dashboard">Go to your dashboard</Button> : <Button href="/">Go to the home page</Button>}
    </PageLayout>
  );
}
