import { useState } from "react";
import { useRouter } from "next/router";
import { completeOnboarding } from "../lib/api";

const steps = [
  { title: "Welcome to Nabad", text: "Nabad helps you understand where to seek care when health concerns arise." },
  { title: "Set up your profile", text: "Add your contact details and, if needed, create linked profiles for family members you help care for." },
  { title: "Find your way around", text: "Your dashboard opens your profile. You can update personal details and manage linked profiles there." },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  async function finish() {
    try { await completeOnboarding(); } catch {}
    router.push("/dashboard");
  }

  return <main aria-live="polite" style={{ maxWidth: 560, margin: "12vh auto", padding: 24, fontFamily: "sans-serif", textAlign: "center" }}>
    <p>Getting started · {step + 1} of {steps.length}</p>
    <h1>{steps[step].title}</h1>
    <p style={{ lineHeight: 1.7 }}>{steps[step].text}</p>
    <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 28 }}>
      {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
      <button onClick={() => step === steps.length - 1 ? finish() : setStep(step + 1)}>{step === steps.length - 1 ? "Go to dashboard" : "Next"}</button>
      <button type="button" onClick={finish}>Skip</button>
    </div>
  </main>;
}
