import { useRouter } from "next/router";
import PageLayout, { SiteHeader } from "../components/ui/PageLayout";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatDivider } from "../components/ui/Heartbeat";
import { CaregiverHands, MedicineBox, PersonWithPhone, SmallHouse } from "../components/illustrations";

const features = [
  {
    Illustration: PersonWithPhone,
    title: "Check your symptoms",
    text: "Tell us how you feel, by typing or speaking, and we'll help you understand how urgent it is.",
  },
  {
    Illustration: MedicineBox,
    title: "The right hospital in an emergency",
    text: "We point you to a nearby hospital that is equipped for your condition, not just the closest one.",
  },
  {
    Illustration: SmallHouse,
    title: "Find hospitals and clinics",
    text: "Search by specialty, location and availability.",
  },
  {
    Illustration: CaregiverHands,
    title: "Care for your family",
    text: "Look after your children or parents from your own account.",
  },
];

const steps = ["Create your account", "Tell us how you feel", "Get clear next steps and directions"];

export default function HomePage() {
  // The profile page sends users to "/?deleted=1" after they delete their account.
  const router = useRouter();

  return (
    <PageLayout
      width="wide"
      header={
        <SiteHeader width="wide">
          <a href="/login" className="site-nav__link">Log in</a>
          <Button href="/signup" size="small">Sign up</Button>
        </SiteHeader>
      }
      footer={<p>Nabad, built by Team 3 for CMPS 271, AUB</p>}
    >
      {router.query.deleted && (
        <Alert tone="success" as="p" role="status">
          Your account has been deleted.
        </Alert>
      )}

      <section className="hero">
        <h1>Know where to go when it matters.</h1>
        <HeartbeatDivider />
        <p className="lead">
          Tell us how you feel. We'll help you understand how urgent it is and find a hospital that can
          treat you.
        </p>
        <Button href="/signup">Get started</Button>
      </section>

      <section className="section" aria-labelledby="features-heading">
        <h2 id="features-heading">How Nabad helps</h2>
        <ul className="feature-list">
          {features.map(({ Illustration, title, text }) => (
            <li key={title}>
              <Illustration size="4.5rem" />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="steps-heading">
        <h2 id="steps-heading">How it works</h2>
        <ol className="steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <Alert tone="note" title="Nabad is not a doctor." className="section prose">
        <p>
          It does not diagnose illness or replace advice from a medical professional. In an emergency,
          call 140 (Lebanese Red Cross).
        </p>
      </Alert>
    </PageLayout>
  );
}
