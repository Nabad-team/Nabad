# Asking questions about your own history (SCRUM-156)

> As a user, I want to ask natural-language questions about my own history so that I can recall past symptoms or visits.

**Ask about my history** (`/my-history`, linked from the Safety check's "Previous symptom checks" and from the header search) answers questions such as:

- "When did I last have a headache?"
- "How many times did I see a doctor this year?"
- "What did I check last month?"
- "What medicines was I taking in March?"
- "Did I upload any lab results since September?"

It answers for the profile chosen in the header (the person's own, or a family member's), from that profile's **symptom checks, appointments (visits), medications and medical documents** only.

## How it works

`POST /api/history/ask?profileId=` with `{ question, timeZone, useAi }` (`backend/src/historyQuestions.js`):

1. **Understanding the question, without AI.** The period ("today", "last week", "this month", "last month", "in March", "March 2025", "since September", "the past 3 months", "2 weeks ago", "lately", "in 2025"), in the person's own time zone; the kind of record (symptoms, visits, medicines, documents; symptom checks and visits when none is named); what is asked (the last time, the first time, how many, or a list); and the words to look for, with plurals and common synonyms ("tummy" also finds "stomach", "cardiologist" finds "cardiology").
2. **Finding the records**, newest first (oldest first for "the first time"). Records matching more of the words come first; appointments that haven't happened yet are left out of "the last time" and marked "Upcoming" otherwise. A medication counts for a period if it was being taken at any point in it.
3. **Answering.** By default the answer is written from the records by the server ("The most recent one mentioning "headache": on 3 October 2026 you described..."). This always works, AI or not.
4. **With the person's consent** (the tick box), the configured AI model writes the answer from the found records only (at most 20), and must cite them by id. The answer is rejected, and the plain one used instead, if it cites a record it wasn't given, cites nothing, diagnoses, reassures, gives advice, or contains a link or phone number. The records are sent as data with instructions to ignore any orders inside them.

The records found are always listed under the answer, with their date, what was said and a link, so the person can check it. "Used in the answer" marks the ones the AI cited.

If the question describes an emergency happening now ("I have crushing chest pain right now, did I have this before?"), the answer comes with a **call 140** message first (`reports/chatSafety.js`, as in the health assistant).

## Privacy and limits

- Only the signed-in account's records for the chosen profile are searched. Another account's profile answers 404.
- Nothing about the question or the records is logged: `history_question` with `ai:<count>` or `search:<count>` and, when the AI wasn't used, a fixed reason code.
- Without the tick box, nothing is sent to the AI provider. AI calls count against the usage limits of SCRUM-310 (`docs/ai-fallback.md`).
- 30 questions per account per 15 minutes; questions up to 300 characters; up to 500 records of each kind are searched, newest first.
- English only. It recalls what was saved; it does not interpret it, and it is not medical advice.

## Tests

- `backend/tests/historyQuestions.test.js`: periods (including a time-zone boundary), kinds, intents, keywords and synonyms; checking AI answers; finding and answering from a seeded history (headaches, stomach synonyms, visits, upcoming appointments, medications in a month, documents, nothing found, profile isolation); AI answers, failures and fallbacks; and the HTTP route (validation, no AI without consent, logs, the safety message).
- `frontend/__tests__/myHistory.test.js`.
