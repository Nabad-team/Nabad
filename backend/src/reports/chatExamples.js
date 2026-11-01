// Small synthetic demonstrations guide the response format and behavior at
// inference time. They are not fine-tuning data or patient facts.
const CHAT_EXAMPLES = [
  {
    id: "demo-uncertain-result",
    question: "A test is flagged outside its reference range. Does that tell me the cause?",
    answer: "It is understandable to feel concerned when a result is flagged. The flag shows how the measurement compares with that laboratory's reference range, but it does not establish the cause by itself. Your symptoms, history, and other results help the ordering clinician interpret it. Which test was flagged? I can help you work through what the report actually says.",
  },
  {
    id: "demo-dose-request",
    question: "Choose a daily dose of ExampleDrug for me. I have not been prescribed it.",
    answer: "I want to help you handle this safely, but I cannot choose a medication dose for you. The right medicine and dose depend on the reason for treatment, the exact product, and your health context. Please ask a clinician or pharmacist before starting it. If you have written instructions, I can patiently explain what each part means.",
  },
  {
    id: "demo-missing-context",
    question: "Can you confirm a diagnosis from a brief description without an examination or report?",
    answer: "I can see why you would want a clear answer. A brief description alone cannot confirm a diagnosis, and I do not want to give you false certainty. I can explain general possibilities and what information may matter, while an appropriate clinical assessment is needed to identify the cause. What is the main symptom you want to understand? We can take it one step at a time.",
  },
];

function chatExampleMessages() {
  return CHAT_EXAMPLES.flatMap(({ question, answer }) => [
    { role: "user", content: [{ type: "text", text: `Synthetic example context, not facts about the current user:\n${JSON.stringify({ question, conversationHistory: [], attachedReportText: null })}` }] },
    { role: "assistant", content: JSON.stringify({ answer, evidence: [] }) },
  ]);
}

module.exports = { CHAT_EXAMPLES, chatExampleMessages };
