import { useState } from "react";
import { useRouter } from "next/router";
import { completeOnboarding } from "../lib/api";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Button from "../components/ui/Button";
import { CaregiverHands, PersonWithPhone, SmallHouse } from "../components/illustrations";

const steps = [
  { title: "Welcome to Nabad", text: "When you're worried about your health, Nabad helps you understand where to go for care.", Illustration: PersonWithPhone },
  { title: "Set up your profile", text: "Add your contact details. If you look after family members, you can add a profile for each of them too.", Illustration: CaregiverHands },
  { title: "Find your way around", text: "Your dashboard is your home in Nabad. From there you can open your profile, update your details and manage family profiles.", Illustration: SmallHouse },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const { title, text, Illustration } = steps[step];

  async function finish() {
    try { await completeOnboarding(); } catch {}
    router.push("/dashboard");
  }

  return (
    <PageLayout>
      <div aria-live="polite" className="onboarding">
        <Illustration size="7rem" />
        <p className="eyebrow">Getting started · {step + 1} of {steps.length}</p>
        <PageTitle lead={text}>{title}</PageTitle>
        <div className="button-row">
          {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
          <Button onClick={() => step === steps.length - 1 ? finish() : setStep(step + 1)}>{step === steps.length - 1 ? "Go to dashboard" : "Next"}</Button>
          <Button variant="secondary" onClick={finish}>Skip</Button>
        </div>
      </div>
    </PageLayout>
  );
}

// Shown right after signup: only for signed-in users (see components/RequireSignIn.js).
OnboardingPage.requireSignIn = true;
