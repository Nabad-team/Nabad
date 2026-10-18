import { useRouter } from "next/router";
import PageLayout, { SiteHeader } from "../components/ui/PageLayout";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import { HeartbeatDivider } from "../components/ui/Heartbeat";
import { MedicineBox, PersonWithPhone, SmallHouse, TwoHearts } from "../components/illustrations";

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
    comingSoon: true,
  },
  {
    Illustration: SmallHouse,
    title: "Find hospitals and clinics",
    text: "Search by specialty, location and availability.",
    href: "/providers",
  },
  {
    Illustration: TwoHearts,
    title: "Care for your family",
    text: "Look after the people you care for from your own account.",
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
          <a href="/providers" className="site-nav__link">Find care</a>
          <a href="/login" className="site-nav__link">Log in</a>
          <Button href="/signup" size="small">Sign up</Button>
        </SiteHeader>
      }
    >
      {router.query.deleted && (
        <Alert tone="success" as="p" role="status">
          Your account has been deleted.
        </Alert>
      )}

      <section className="hero">
        <div className="hero__text">
          <h1>Know where to go when it matters.</h1>
          <HeartbeatDivider />
          <p className="lead">
            Tell us how you feel. We'll help you understand how urgent it is and find a hospital that can
            treat you.
          </p>
          <Button href="/signup">Get started</Button>
        </div>
        <div className="hero__art">
          {/* Cropped to the drawing; a thinner line keeps it as fine as the small drawings at this size. */}
          <PersonWithPhone size="100%" strokeWidth={0.7} viewBox="14 28.4 88 80.6" />
        </div>
      </section>

      <section className="section" aria-labelledby="features-heading">
        <h2 id="features-heading">How Nabad helps</h2>
        <ul className="feature-list">
          {features.map(({ Illustration, title, text, comingSoon, href }) => (
            <li key={title}>
              <Illustration size="4.5rem" />
              <div>
                <h3>
                  {href ? <a href={href}>{title}</a> : title}
                  {comingSoon && <> <Badge>Coming soon</Badge></>}
                </h3>
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
