import { useEffect, useState } from "react";
import ProfileHeader from "../../components/ProfileHeader";
import PageLayout from "../../components/ui/PageLayout";
import PageTitle from "../../components/ui/PageTitle";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import EmptyState from "../../components/ui/EmptyState";
import Dialog from "../../components/Dialog";
import { HeartbeatLoader } from "../../components/ui/Heartbeat";
import { useActiveProfile } from "../../context/ActiveProfileContext";
import {
  CARE_CIRCLE_PROMISE,
  cancelCareCircleInvite,
  getCareCircle,
  inviteToCareCircle,
  leaveCareCircle,
  longDate,
  removeCareCircleMember,
} from "../../lib/careCircleApi";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The care circle: invite people by email, see pending invitations, remove members, and leave other people's circles.
// Members only ever learn that a symptom check needs attention (the backend's careCircle.js), never what it was.
export default function CareCirclePage() {
  const { selfProfile } = useActiveProfile() || {};
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  // { kind: "remove" | "leave", item }: the confirmation dialog.
  const [confirming, setConfirming] = useState(null);

  async function load() {
    setLoadError("");
    try {
      setData(await getCareCircle());
    } catch {
      setLoadError("We couldn't load your care circle. Please check your connection and try again.");
    }
  }
  useEffect(() => { load(); }, []);

  const full = data && data.members.length + data.pending.length >= data.maxMembers;

  async function invite(event) {
    event.preventDefault();
    setNotice(""); setError("");
    const address = email.trim();
    if (!EMAIL.test(address)) { setEmailError("Enter a valid email address, like name@example.com."); return; }
    setEmailError("");
    setInviting(true);
    try {
      const result = await inviteToCareCircle(address);
      setNotice(result.message);
      setEmail("");
      await load();
    } catch (failure) {
      setError(failure.message || "We couldn't send the invitation. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function act(action, success, failure) {
    setNotice(""); setError("");
    try {
      await action();
      setNotice(success);
      await load();
    } catch {
      setError(failure);
    }
  }

  const cancel = (invite) => act(() => cancelCareCircleInvite(invite.id), `Invitation to ${invite.email} cancelled.`, "We couldn't cancel that invitation. Please try again.");

  async function confirm() {
    const { kind, item } = confirming;
    setConfirming(null);
    if (kind === "remove") await act(() => removeCareCircleMember(item.id), `${item.name} was removed from your care circle.`, "We couldn't remove them. Please try again.");
    else await act(() => leaveCareCircle(item.id), `You left ${item.name}'s care circle.`, "We couldn't leave that care circle. Please try again.");
  }

  return (
    <PageLayout title="Care circle" header={<ProfileHeader showPicture={false} />}>
      <PageTitle lead={CARE_CIRCLE_PROMISE}>Care circle</PageTitle>

      {notice && <Alert tone="success" as="p" role="status">{notice}</Alert>}
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {loadError && <div className="stack"><Alert tone="danger" as="p" role="alert">{loadError}</Alert><Button variant="secondary" onClick={load}>Try again</Button></div>}
      {!loadError && data === null && <HeartbeatLoader label="Loading your care circle..." />}

      {data && (
        <>
          <section className="section" aria-labelledby="invite-heading">
            <h2 id="invite-heading">Invite someone</h2>
            <p>
              They get an email with a link to join. When one of your symptom checks, or a check for someone in your family on Nabad,
              comes out urgent or an emergency, they get an alert with your name and how urgent it is.
            </p>
            <p className="text-muted text-sm">
              {selfProfile?.phone
                ? `The alert includes your phone number (${selfProfile.phone}), so they can call you.`
                : <>Add a phone number on <a href="/profile">My profile</a> so they can call you straight from the alert.</>}
            </p>
            <form className="form care-circle__invite" onSubmit={invite} noValidate>
              <Input
                id="care-circle-email"
                label="Their email address"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={emailError}
                hint={`Up to ${data.maxMembers} people, invitations included. Invitations expire after 7 days.`}
                disabled={full}
              />
              <div className="form-actions">
                <Button type="submit" disabled={inviting || full}>{inviting ? "Sending..." : "Send invitation"}</Button>
              </div>
              {full && <p className="text-muted">Your care circle is full. Remove someone or cancel an invitation to invite someone else.</p>}
            </form>
          </section>

          <section className="section" aria-labelledby="members-heading">
            <h2 id="members-heading">People in your care circle</h2>
            {data.members.length === 0 ? (
              <EmptyState title="No one is in your care circle yet.">Invite someone you trust, like a family member or a close friend.</EmptyState>
            ) : (
              <ul className="plain-list">
                {data.members.map((member) => (
                  <li key={member.id}>
                    <span><strong>{member.name}</strong> <span className="text-muted">{member.email}</span><br /><span className="text-muted text-sm">Since {longDate(member.since)}</span></span>
                    <Button variant="secondary" size="small" onClick={() => setConfirming({ kind: "remove", item: member })} aria-label={`Remove ${member.name}`}>Remove</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.pending.length > 0 && (
            <section className="section" aria-labelledby="pending-heading">
              <h2 id="pending-heading">Waiting to accept</h2>
              <ul className="plain-list">
                {data.pending.map((invite) => (
                  <li key={invite.id}>
                    <span><strong>{invite.email}</strong><br /><span className="text-muted text-sm">Invitation expires on {longDate(invite.expiresAt)}</span></span>
                    <Button variant="secondary" size="small" onClick={() => cancel(invite)} aria-label={`Cancel the invitation to ${invite.email}`}>Cancel invitation</Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="section" aria-labelledby="circles-heading">
            <h2 id="circles-heading">Circles I'm in</h2>
            <p>You get an alert in Nabad and by email when one of these people's symptom checks needs attention. You never see their symptoms.</p>
            {data.circles.length === 0 ? (
              <EmptyState title="You're not in anyone's care circle.">When someone invites you, open the link in their email to join.</EmptyState>
            ) : (
              <ul className="plain-list">
                {data.circles.map((circle) => (
                  <li key={circle.id}>
                    <span><strong>{circle.name}</strong><br /><span className="text-muted text-sm">Since {longDate(circle.since)}</span></span>
                    <Button variant="secondary" size="small" onClick={() => setConfirming({ kind: "leave", item: circle })} aria-label={`Leave ${circle.name}'s care circle`}>Leave</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {confirming && (
        <Dialog title={confirming.kind === "remove" ? `Remove ${confirming.item.name}?` : `Leave ${confirming.item.name}'s care circle?`}>
          <p>
            {confirming.kind === "remove"
              ? `${confirming.item.name} will no longer be told when your symptom checks need attention. You can invite them again later.`
              : `You will no longer be told when ${confirming.item.name}'s symptom checks need attention. They can invite you again later.`}
          </p>
          <div className="form-actions">
            <Button variant="danger" onClick={confirm}>{confirming.kind === "remove" ? "Remove" : "Leave"}</Button>
            <Button variant="secondary" onClick={() => setConfirming(null)}>Cancel</Button>
          </div>
        </Dialog>
      )}
    </PageLayout>
  );
}

CareCirclePage.requireSignIn = true;
