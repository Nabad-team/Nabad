import { useEffect, useState } from "react";
import Button from "./ui/Button";

export default function ReadAloudButton({ text }) {
  const [speaking, setSpeaking] = useState(false);
  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function";

  useEffect(() => () => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  if (!supported) return null;

  function toggleReadAloud() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <Button variant="secondary" onClick={toggleReadAloud} aria-pressed={speaking}>
      {speaking ? "Stop reading" : "Read aloud"}
    </Button>
  );
}
