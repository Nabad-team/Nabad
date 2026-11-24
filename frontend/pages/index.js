import { useRouter } from "next/router";
import PageLayout, { SiteHeader } from "../components/ui/PageLayout";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import HeldMark from "../components/ui/HeldMark";
import HeldIcon from "../components/ui/HeldIcon";
import { LogoMark } from "../components/Logo";
import { UrgencyScale } from "../components/UrgencyResult";

// The four main things Nabad does. Each card links to its page (signed-in pages ask visitors to log in first).
const features = [
  {
    icon: "symptom",
    title: "Symptom check",
    text: "Tell us how you feel, by typing or speaking, and we'll help you understand how urgent it is.",
    href: "/symptoms",
  },
  {
    icon: "emergencyCard",
    title: "The right hospital in an emergency",
    text: "See hospitals with a 24/7 emergency department that publish what your condition needs, nearest first when you share your location.",
    href: "/providers?emergency24h=true",
  },
  {
    icon: "search",
    title: "Find hospitals and clinics",
    text: "Search by specialty, location and availability.",
    href: "/providers",
  },
  {
    icon: "family",
    title: "Care for your family",
    text: "Look after the people you care for from your own account.",
    href: "/profile",
  },
];

// Everything else in a Nabad account, in a few words each. Keep this list to what exists.
const moreFeatures = [
  ["medicine", "Medications and reminders", "Keep a list of what you take, with reminders at the times you choose."],
  ["vitals", "Vitals", "Log blood pressure, heart rate and temperature, and see how they change."],
  ["document", "Documents", "Keep medical and administrative documents together."],
  ["clipboard", "Visit preparation", "A summary for your doctor, to print or share securely."],
  ["bell", "Care circle", "People you trust are told when a symptom check needs attention, never what it was."],
  ["lock", "Offline emergency card", "Your key health information, ready to show a doctor, even without internet."],
];

// A made-up result, so visitors can see what a symptom check gives back: the real result's header (the level's soft
// colour, the done ring, the level once with how soon, the action) and its four-segment bar. Clearly labelled as a
// sample, with the triage API's own wording for "See a doctor soon". Nothing in it is interactive.
function SampleResult() {
  return (
    <figure className="sample-result" aria-labelledby="sample-result-caption">
      <figcaption id="sample-result-caption" className="sample-result__caption">
        <Badge tone="neutral">Sample</Badge> An example result, with made-up symptoms
      </figcaption>
      <div className="sample-result__card urgency urgency--soon">
        <p className="sample-result__quote">“Fever since yesterday and a sore throat”</p>
        <div className="urgency__indicator">
          <HeldMark state="done" size="3.25rem" className="urgency__mark" />
          <div className="urgency__heading-block">
            <p className="sample-result__level">Urgency: See a doctor soon</p>
            <p className="urgency__timeframe"><span className="urgency__timeframe-label">How soon:</span> Within 24 to 48 hours</p>
            <p className="urgency__action">Book an appointment with a doctor in the next day or two. Get help sooner if it gets worse.</p>
          </div>
          <UrgencyScale level="soon" />
        </div>
        <p className="sample-result__next">Then: family medicine providers near you</p>
      </div>
    </figure>
  );
}

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
      {/* A slim, always-visible way to call for help (the footer line has 140 too). Said once: who answers and that
          no account is needed are part of the same strip. */}
      <a href="tel:140" className="emergency-bar">
        <HeldIcon name="phone" size="1.25rem" className="emergency-bar__icon" />
        <span><strong>Emergency?</strong> Call <span className="num">140</span><span className="emergency-bar__more"> · Lebanese Red Cross, no sign-in needed</span></span>
      </a>

      {router.query.deleted && (
        <Alert tone="success" as="p" role="status">
          Your account has been deleted.
        </Alert>
      )}

      <section className="hero">
        <div className="hero__text">
          <LogoMark size="7rem" className="hero__mark" />
          <h1>Know where to go when it matters.</h1>
          <p className="lead">
            Tell us how you feel. We'll help you understand how urgent it is and find a hospital that can
            treat you.
          </p>
          <Button href="/signup" className="hero__cta">Get started</Button>
        </div>
        <SampleResult />
      </section>

      <section className="section" aria-labelledby="features-heading">
        <h2 id="features-heading">How Nabad helps</h2>
        <ul className="feature-list">
          {features.map(({ icon, title, text, href }) => (
            <li key={title}>
              <a href={href} className="feature-card">
                <span className="feature-card__icon"><HeldIcon name={icon} size="1.75rem" /></span>
                <h3 className="feature-card__title">{title}</h3>
                <p className="feature-card__text">{text}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="more-features-heading">
        <h2 id="more-features-heading">Also in your account</h2>
        <ul className="more-features">
          {moreFeatures.map(([icon, title, text]) => (
            <li key={title}>
              <span className="more-features__icon"><HeldIcon name={icon} size="1.25rem" /></span>
              <span><strong>{title}</strong> <span>{text}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="steps-heading">
        <h2 id="steps-heading">How it works</h2>
        <ol className="steps steps--line">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </PageLayout>
  );
}
