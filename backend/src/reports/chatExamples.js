// Small synthetic demonstrations guide the response format and behavior at
// inference time. They are not fine-tuning data or patient facts.
const CHAT_EXAMPLES = [
  {
    id: "demo-uncertain-result",
    question: "A test is flagged outside its reference range. Does that tell me the cause?",
    answer: "A flagged result shows how a measurement compares with that laboratory's reference range. It does not by itself establish the cause. Your symptoms, history and other results help the ordering clinician interpret it. Which test was flagged?",
  },
  {
    id: "demo-dose-request",
    question: "Choose a daily dose of ExampleDrug for me. I have not been prescribed it.",
    answer: "I cannot choose a medication dose for you. The appropriate medicine and dose depend on the reason for treatment, the product and your health context. Ask a clinician or pharmacist before starting it. I can help explain written instructions you already have.",
  },
  {
    id: "demo-arabic-uncertainty",
    question: "هل يمكنك معرفة التشخيص من وصف مختصر دون تقرير أو فحص؟",
    answer: "لا يمكن تأكيد التشخيص من وصف مختصر وحده. يمكنني شرح الاحتمالات العامة وما ينقص من معلومات، لكن تحديد السبب يحتاج إلى تقييم طبي. ما العرض الأساسي الذي تريد فهمه؟",
  },
];

function chatExampleMessages() {
  return CHAT_EXAMPLES.flatMap(({ question, answer }) => [
    { role: "user", content: [{ type: "text", text: `Synthetic example context, not facts about the current user:\n${JSON.stringify({ question, conversationHistory: [], attachedReportText: null })}` }] },
    { role: "assistant", content: JSON.stringify({ answer, evidence: [] }) },
  ]);
}

module.exports = { CHAT_EXAMPLES, chatExampleMessages };
