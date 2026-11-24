import { useRouter } from "next/router";
import PageLayout, { SiteHeader } from "../components/ui/PageLayout";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import { TitleBar } from "../components/ui/PageTitle";
import HeldMark from "../components/ui/HeldMark";
import { MedicineBox, PersonWithPhone, SmallHouse, TwoHearts } from "../components/illustrations";
import { URGENCY_SCALE, UrgencyIcon } from "../components/UrgencyResult";

// The four main things Nabad does. Each card links to its page (signed-in pages ask visitors to log in first).
const features = [
  {
    Illustration: PersonWithPhone,
    title: "Symptom check",
    text: "Tell us how you feel, by typing or speaking, and we'll help you understand how urgent it is.",
    href: "/symptoms",
  },
  {
    Illustration: MedicineBox,
    title: "The right hospital in an emergency",
    text: "See hospitals with a 24/7 emergency department that publish what your condition needs, nearest first when you share your location.",
    href: "/providers?emergency24h=true",
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
    href: "/profile",
  },
];

// Everything else in a Nabad account, in a few words each. Keep this list to what exists.
const moreFeatures = [
  ["Medications and reminders", "Keep a list of what you take, with reminders at the times you choose."],
  ["Vitals", "Log blood pressure, heart rate and temperature, and see how they change."],
  ["Documents", "Keep medical and administrative documents together."],
  ["Visit preparation", "A summary for your doctor, to print or share securely."],
  ["Care circle", "People you trust are told when a symptom check needs attention, never what it was."],
  ["Offline emergency card", "Your key health information, ready to show a doctor, even without internet."],
];

// A made-up result, so visitors can see what a symptom check gives back. Built in HTML, clearly labelled as a sample,
// with the triage API's own wording for "See a doctor soon". Nothing in it is interactive.
function SampleResult() {
  return (
    <figure className="sample-result" aria-labelledby="sample-result-caption">
      <figcaption id="sample-result-caption" className="sample-result__caption">
        <Badge tone="neutral">Sample</Badge> An example result, with made-up symptoms
      </figcaption>
      <div className="sample-result__card urgency urgency--soon">
        <p className="sample-result__quote">“Fever since yesterday and a sore throat”</p>
        <div className="urgency__indicator">
          <UrgencyIcon level="soon" />
          <div>
            <p className="sample-result__level">Urgency: See a doctor soon</p>
            <p className="sample-result__line">Book an appointment with a doctor in the next day or two.</p>
          </div>
        </div>
        <ol className="urgency-scale__steps sample-result__scale" aria-label="Urgency scale, from lowest to highest">
          {URGENCY_SCALE.map(([key, label]) => (
            <li key={key} className={`urgency-scale__step urgency-scale__step--${key}${key === "soon" ? " urgency-scale__step--current" : ""}`}
              aria-current={key === "soon" ? "step" : undefined}>
              <span className="urgency-scale__name">{label}</span>
              {key === "soon" && <span className="urgency-scale__you">This result</span>}
            </li>
          ))}
        </ol>
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
      {/* A slim, always-visible way to call for help. The larger box further down stays too. */}
      <a href="tel:140" className="emergency-bar">
        <svg className="emergency-bar__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.2 3.5 10 8 8.4 9.8c1.2 2.5 3.3 4.6 5.8 5.8L16 14l4.5 2.8-.9 3.2c-.2.7-.9 1.2-1.7 1.1C9.8 20.2 3.8 14.2 2.9 6.1c-.1-.8.4-1.5 1.1-1.7l3.2-.9Z" /></svg>
        <span><strong>Emergency?</strong> Call 140</span>
      </a>

      {router.query.deleted && (
        <Alert tone="success" as="p" role="status">
          Your account has been deleted.
        </Alert>
      )}

      <section className="hero">
        <div className="hero__text">
          <HeldMark state="resting" size="7rem" className="hero__mark" />
          <h1>Know where to go when it matters.</h1>
          <TitleBar />
          <p className="lead">
            Tell us how you feel. We'll help you understand how urgent it is and find a hospital that can
            treat you.
          </p>
          <Button href="/signup">Get started</Button>
        </div>
        <SampleResult />
      </section>

      <section className="section" aria-labelledby="features-heading">
        <h2 id="features-heading">How Nabad helps</h2>
        <ul className="feature-list">
          {features.map(({ Illustration, title, text, href }) => (
            <li key={title}>
              <Illustration size="4.5rem" />
              <div>
                <h3><a href={href}>{title}</a></h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="more-features-heading">
        <h2 id="more-features-heading">Also in your account</h2>
        <ul className="more-features">
          {moreFeatures.map(([title, text]) => (
            <li key={title}><strong>{title}</strong> <span>{text}</span></li>
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

      <a href="tel:140" className="emergency-callout section" aria-label="Emergency? Call 140 (Lebanese Red Cross) now">
        <span className="emergency-callout__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M7.2 3.5 10 8 8.4 9.8c1.2 2.5 3.3 4.6 5.8 5.8L16 14l4.5 2.8-.9 3.2c-.2.7-.9 1.2-1.7 1.1C9.8 20.2 3.8 14.2 2.9 6.1c-.1-.8.4-1.5 1.1-1.7l3.2-.9Z" /></svg>
        </span>
        <span className="emergency-callout__copy">
          <strong className="emergency-callout__title">Emergency? Call 140 now</strong>
          <span>Contact the Lebanese Red Cross immediately. You do not need to sign in.</span>
          <small>Nabad is not a doctor and does not replace professional medical advice.</small>
        </span>
        <span className="emergency-callout__action" aria-hidden="true">Call 140 <span>→</span></span>
      </a>
    </PageLayout>
  );
}
