# Questions for my doctor (SCRUM-333)

> Questions for my doctor: save a question at any time and see it in visit preparation, the shared doctor link and the printout.

People forget what they wanted to ask once they are in the doctor's office. Nabad lets them write a question down whenever they think of it, for themselves or for a family member, and puts the list in front of the doctor.

## Where

- **Save a question:** the "Questions for my doctor" card on **Visit preparation**, **My history** and **My appointments** (`components/DoctorQuestions.js`). It saves for the profile chosen in the header.
- **Edit and remove:** on Visit preparation.
- **Seen by the doctor:** Visit preparation adds a "Questions for my doctor" section, numbered, after the current medications and before the notes, to:
  - the **shared doctor link** (the section is part of the link's frozen snapshot, like the rest of the sheet; a question added later needs a new link),
  - the **printout** ("Print or save as PDF"),
  - the **export** ("Export sheet with attachments").
  Without questions, the section is left out.

## API

Questions are kept with the profile's visit sheet (`models/VisitPrep.js`, field `questions`), so removing a profile or the account deletes them, and **Download my data** includes them (`visitPreparation.questionsForMyDoctor`).

| Route | Body | Answer |
| --- | --- | --- |
| `GET /api/visit-prep?profileId=` | | the sheet, now with `questions: [{ id, text, createdAt, updatedAt }]`, oldest first |
| `POST /api/visit-prep/questions?profileId=` | `{ text }` | 201 `{ question, questions }` |
| `PATCH /api/visit-prep/questions/:id?profileId=` | `{ text }` | `{ question, questions }` |
| `DELETE /api/visit-prep/questions/:id?profileId=` | | `{ questions }` |

- One line of 1 to 300 characters (spaces and line breaks are folded into single spaces).
- At most 30 per profile. The check is part of the same database update as the save, so two saves at the same moment can't go past it.
- Saving the rest of the sheet (`PUT /api/visit-prep`) never touches the questions.
- Sign-in and the site's origin are required; another account's profile or question answers 404. 100 writes per account per 15 minutes, shared with the rest of the visit sheet. Questions are health data: never logged, never sent to the AI.

## Tests

`backend/tests/doctorQuestions.test.js` (saving before a sheet exists, folding spaces, editing, removing, limits, 30 at once, profiles and accounts, sign-in and origin, the data export), `frontend/__tests__/doctorQuestions.test.js` (the list and the small card) and `frontend/__tests__/visit-prep.test.js` (the section in the doctor link, the PDF and the export, in order).
