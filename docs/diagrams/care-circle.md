# Care circle: invite, accept and alert

A user (the inviter) invites someone by email, that person accepts, and later one of the inviter's symptom checks comes out as an emergency. The code: [routes/careCircle.js](../../backend/src/routes/careCircle.js), [careCircle.js](../../backend/src/careCircle.js), [notifications.js](../../backend/src/notifications.js) and [routes/triage.js](../../backend/src/routes/triage.js). PNG: [png/care-circle.png](./png/care-circle.png).

```mermaid
sequenceDiagram
    autonumber
    actor I as Inviter
    participant FE as Nabad web app<br/>(+ /api proxy)
    participant API as Care circle API<br/>/api/care-circle
    participant TR as Triage route<br/>(careCircle.js)
    participant DB as MongoDB
    participant EM as Email<br/>(Brevo)
    actor M as Member<br/>(caregiver)

    rect rgb(235, 244, 255)
    Note over I,M: 1. Invite by email
    I->>FE: Care circle page: enters an email address
    FE->>API: POST /invites { email }
    API->>API: Valid, not yourself, at most 5 people,<br/>10 invitations per hour
    API->>DB: Pending invitation: SHA-256 of a random token, expires in 7 days
    API-)EM: Invitation email with /care-circle/accept?token=...
    EM-)M: Rana invited you to their Nabad care circle
    API-->>FE: 202 Invitation sent (same answer whether or not the email has an account)
    end

    rect rgb(236, 250, 240)
    Note over I,M: 2. Accept
    M->>FE: Opens the link
    FE->>API: POST /invites/lookup { token }
    API-->>FE: Inviter's name and the invited email
    FE-->>M: Signed out? Log in or sign up with the invited email first
    M->>FE: Accept
    FE->>API: POST /invites/accept { token }
    API->>API: Signed-in email must be the invited one (403 otherwise)
    API->>DB: Atomic update: active, member set, token removed (link works once)
    API->>DB: notify(inviter, system): Sami joined your care circle
    API-->>FE: You're now in Rana's care circle
    end

    rect rgb(255, 240, 240)
    Note over I,M: 3. Emergency check alerts the member
    I->>FE: Symptom check: comes out as emergency
    FE->>TR: POST /api/triage/ai-assess { symptoms, checkId }
    TR-->>FE: Emergency result, sent first
    TR-)TR: alertCareCircleInBackground({ owner, profileId, level, checkId })
    Note right of TR: Only the level goes in, never symptoms or answers
    TR->>DB: Active members only (pending invitees get nothing)
    TR->>DB: notify(member, caregiver_urgent): always on,<br/>dedupe key per check, so one alert per check
    TR-)EM: Alert email, only if the notification was created
    EM-)M: Care circle alert from Rana
    M->>FE: Bell: Rana's symptom check needs attention (emergency). Call button
    end

    Note over I,M: Shared with the member: the person's name, the level, a link to Nabad and the inviter's phone if saved.<br/>Never shared: symptoms, answers, advice, records or any other health detail.
```

- **Invitations** are one document per person in [models/CareCircle.js](../../backend/src/models/CareCircle.js). Only the token's hash is stored; the token itself is only in the email. Expired invitations are removed by a TTL index.
- **The alert** is `caregiver_urgent`, which users can't turn off, so a caregiver can't miss one by accident. Logs say only `care_circle_alerted` with how many members were told.
- **Leaving.** The inviter can cancel invitations and remove members; a member can leave. Deleting either account removes the relationship.
