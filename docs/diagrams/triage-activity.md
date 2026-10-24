# Activity diagram: symptom triage and care navigation

A UML activity diagram (drawn as a Mermaid flowchart, one swimlane per subgraph) of how a symptom check works today, from describing symptoms to getting care. It is updated to the app as built, with the AI triage and its safety floor, the care circle and visit preparation. PNG: [png/triage-activity.png](./png/triage-activity.png).

```mermaid
flowchart LR
    start(((Start)))

    subgraph user["User"]
        describe["Describe symptoms<br/>for self or a linked profile"]
        answerQ{"Answer the<br/>follow-up questions?"}
        answer["Answer the questions"]
        act{"What does the<br/>result say?"}
        call140["Call 140 or the<br/>emergency contact"]
        findCare["Find care in the directory<br/>(filtered by care type),<br/>prepare a visit sheet"]
        selfCare["Follow the self-care<br/>steps at home"]
    end

    subgraph system["Nabad System"]
        rules["Check session and profile,<br/>red-flag rules: safety floor"]
        isEmergency{"Emergency<br/>by the rules?"}
        emergencyRoute["Emergency route: call 140,<br/>nearest emergency department<br/>(AI skipped)"]
        aiReady{"AI configured and<br/>text safe to send?"}
        rulesOnly["Rules answer alone"]
        floor["Final level = the more<br/>serious of rules and AI"]
        result["Show and save the result:<br/>level, reasons, care type,<br/>follow-up questions"]
        alert["Alert active care circle<br/>members: in-app + email,<br/>once per check"]
    end

    subgraph ai["Nabad AI"]
        assess["Gemini assesses: symptoms,<br/>minimum level, answers,<br/>last 3 checks"]
        guard{"Reply passes<br/>the guardrails?"}
    end

    subgraph caregiver["Caregiver"]
        notified["Gets the alert (name and level,<br/>no health details), calls or<br/>checks on the person"]
    end

    subgraph provider["Healthcare Provider"]
        ed["Emergency department<br/>or Red Cross (140)"]
        visit["Clinic or doctor visit,<br/>with the visit sheet"]
    end

    stop(((End)))

    start --> describe --> rules --> isEmergency
    isEmergency -- "yes" --> emergencyRoute --> result
    isEmergency -- "no" --> aiReady
    aiReady -- "no" --> rulesOnly
    aiReady -- "yes" --> assess --> guard
    guard -- "no: error, timeout,<br/>unsafe reply" --> rulesOnly
    guard -- "yes" --> floor
    rulesOnly --> result
    floor --> result
    result -- "urgent or emergency" --> alert --> notified
    result --> answerQ
    answerQ -- "yes (same check)" --> answer --> rules
    answerQ -- "no, or none offered" --> act
    act -- "emergency" --> call140 --> ed
    act -- "urgent or soon" --> findCare --> visit
    act -- "routine" --> selfCare
    ed --> stop
    visit --> stop
    selfCare --> stop
    notified --> stop
```

- **Nabad AI** is the language model (Google Gemini) behind the guardrails; **Nabad System** is the web app and API, including the rules, which keep the final say: the AI can raise the level, never lower it.
- Follow-up answers go through the same flow again with the same check, so the care circle is alerted at most once and the saved record is updated rather than duplicated.
- Visit preparation ([/visit-prep](../../frontend/pages/visit-prep.js)) collects the profile's recent symptoms, health facts, medications and attached documents into a sheet to print or show the doctor.
