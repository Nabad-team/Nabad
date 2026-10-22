import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import ProfileHeader from "../../components/ProfileHeader";
import PageLayout from "../../components/ui/PageLayout";
import PageTitle from "../../components/ui/PageTitle";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import { HeartbeatLoader } from "../../components/ui/Heartbeat";
import { useSessionStatus } from "../../components/SessionTimeout";
import { signOut, signInRequiredUrl } from "../../lib/session";
import { CARE_CIRCLE_PROMISE, acceptCareCircleInvite, lookupCareCircleInvite, longDate } from "../../lib/careCircleApi";

// Opened from the invitation email: /care-circle/accept?token=...
// Public page: a signed-out visitor signs in, or creates an account, with the invited email and comes back here.
export default function AcceptCareCircleInvitePage() {
  const router = useRouter();
  const status = useSessionStatus();
  const [invite, setInvite] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const lookedUpRef = useRef(false);
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const here = `/care-circle/accept?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    if (!router.isReady || lookedUpRef.current) return;
    lookedUpRef.current = true;
    if (!token) { setLookupError("This invitation link is incomplete. Open the link from your email again."); return; }
    lookupCareCircleInvite(token)
      .then(setInvite)
      .catch((failure) => setLookupError(failure.message || "This invitation link is invalid or has expired."));
  }, [router.isReady, token]);

  async function accept() {
    setError(null);
    setAccepting(true);
    try {
      setResult(await acceptCareCircleInvite(token));
    } catch (failure) {
      setError({ message: failure.message || "We couldn't accept the invitation. Please try again.", wrongAccount: failure.status === 403 });
    } finally {
      setAccepting(false);
    }
  }

  const loading = !lookupError && (invite === null || status === "checking");
  return (
    <PageLayout title="Join a care circle" header={<ProfileHeader showPicture={false} />}>
      <PageTitle>Join a care circle</PageTitle>
      {loading && <HeartbeatLoader label="Checking your invitation..." />}
      {lookupError && (
        <div className="stack prose">
          <Alert tone="danger" as="p" role="alert">{lookupError}</Alert>
          <p><a href="/care-circle">Go to your care circle</a></p>
        </div>
      )}

      {!loading && invite && result && (
        <div className="stack prose">
          <Alert tone="success" as="p" role="status">{result.message}</Alert>
          <p>We'll tell you, in Nabad and by email, when one of {invite.inviterName}'s symptom checks needs attention.</p>
          <p><Button href="/care-circle">Go to your care circle</Button></p>
        </div>
      )}

      {!loading && invite && !result && (
        <div className="stack prose">
          <p><strong>{invite.inviterName}</strong> invited you to their care circle.</p>
          <p>
            You'll get an alert when one of {invite.inviterName}'s symptom checks, or a check for someone in their family,
            comes out urgent or an emergency. You'll only see their name and how urgent it is: you never see their symptoms or health details.
          </p>
          <p className="text-muted text-sm">This invitation was sent to {invite.email} and expires on {longDate(invite.expiresAt)}.</p>

          {status === "signedIn" && (
            <>
              {error && <Alert tone="danger" as="p" role="alert">{error.message}</Alert>}
              <div className="form-actions">
                <Button onClick={accept} disabled={accepting}>{accepting ? "Joining..." : `Join ${invite.inviterName}'s care circle`}</Button>
                {error?.wrongAccount
                  ? <Button variant="secondary" onClick={() => signOut(signInRequiredUrl(here))}>Sign in as {invite.email}</Button>
                  : <Button variant="secondary" href="/dashboard">Not now</Button>}
              </div>
            </>
          )}

          {status !== "signedIn" && (
            <>
              <p>To join, sign in with <strong>{invite.email}</strong>, or create a Nabad account with that email. You'll come back here to finish.</p>
              <div className="form-actions">
                <Button href={signInRequiredUrl(here)}>Log in</Button>
                <Button variant="secondary" href={`/signup?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(here)}`}>Create an account</Button>
              </div>
            </>
          )}
          <p className="text-muted text-sm">{CARE_CIRCLE_PROMISE}</p>
        </div>
      )}
    </PageLayout>
  );
}
