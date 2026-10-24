# AI symptom check

What happens when a user checks their symptoms on [/symptoms](../../frontend/pages/symptoms.js). The code: [routes/triage.js](../../backend/src/routes/triage.js) (`POST /api/triage/ai-assess`), [triage/ai/aiTriage.js](../../backend/src/triage/ai/aiTriage.js), [triage/ai/guardrails.js](../../backend/src/triage/ai/guardrails.js), [careCircle.js](../../backend/src/careCircle.js) and [routes/symptoms.js](../../backend/src/routes/symptoms.js). PNG: [png/ai-symptom-check.png](./png/ai-symptom-check.png).

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant FE as Symptoms page<br/>(browser)
    participant PX as /api proxy<br/>(Next.js rewrite)
    participant TR as Triage route<br/>POST /api/triage/ai-assess
    participant RL as Red-flag rules<br/>(urgency.js)
    participant GR as Guardrails<br/>(prompt.js, guardrails.js)
    participant AI as Google Gemini<br/>(OpenAI-compatible API)
    participant DB as MongoDB
    participant CC as Care circle<br/>(careCircle.js, notify)
    participant EM as Email<br/>(Brevo)

    U->>FE: Describes symptoms (self or a linked profile)
    FE->>FE: New checkId (random id for this check)
    FE->>PX: POST /api/triage/ai-assess { symptoms, checkId }
    PX->>TR: Forwards the request with the session cookie
    TR->>TR: requireAuth, resolveProfile, 30 checks per 15 min
    TR->>DB: Last 3 symptom checks of this profile
    DB-->>TR: Earlier checks, as context for the AI
    Note over TR,DB: The My health summary is not sent to the AI today
    TR->>RL: classifyUrgency(symptoms)
    RL-->>TR: Safety floor: minimum level and matched red flags

    alt Rules say emergency
        TR->>TR: Skip the AI, add the emergency route (call 140)
    else AI not configured, or the text tries to give the AI orders
        TR->>TR: The rules answer alone
    else Otherwise
        TR->>GR: Build the prompt: symptoms as data, minimum level
        GR->>AI: Chat completion over HTTPS with API key (15 s timeout)
        AI-->>GR: JSON reply: level, reasons, care type
        GR->>GR: Check the JSON, drop doses, phone numbers, links, diagnoses
        GR-->>TR: Model level and reasons
        TR->>TR: applySafetyFloor: final = the more serious of rules and AI
        Note right of TR: The AI can raise urgency, never lower it.<br/>Timeout, error or rejected reply: the rules answer alone
    end

    TR->>TR: Log the outcome code and duration only, never symptoms
    TR-->>PX: Level, reasons, explanation, care type, follow-up questions
    PX-->>FE: Result
    FE-->>U: Urgency result (emergency: Call 140 and emergency contact)

    TR-)CC: After the response: alertCareCircleInBackground (level only)
    opt Level is urgent or emergency
        CC->>DB: Active members of the user's care circle
        CC->>DB: notify(member, caregiver_urgent): name and level, one alert per checkId
        CC-)EM: Short email to each member, no health details
    end

    FE->>PX: POST /api/symptoms { description, urgencyResult }
    PX->>DB: Symptoms route saves the record for this profile
    DB-->>FE: Saved record, shown in the history

    opt User answers the follow-up questions
        FE->>PX: POST /api/triage/ai-assess { symptoms, answers, same checkId }
        Note over TR,AI: Same flow, the rules re-check the answers as the floor.<br/>Same checkId: the care circle is never alerted twice
        FE->>PX: PATCH /api/symptoms/:id { answers, urgencyResult }
    end
```

- **Safety floor.** The rules always run first, and the final level is the more serious of the rules and the model ([guardrails.js](../../backend/src/triage/ai/guardrails.js) `applySafetyFloor`). A reply that says less serious is ignored.
- **Emergency path.** An emergency by the rules answers at once without calling the model, with the Lebanese Red Cross (140) and the nearest emergency department.
- **Context.** The AI gets the symptoms, the minimum level, the follow-up answers and this profile's last three checks. `getHealthSummary` ([healthProfile.js](../../backend/src/healthProfile.js)) exists but triage does not use it yet.
- **Privacy.** Only the outcome code and duration are logged. The care circle alert gets only the level, never the symptoms or answers.
