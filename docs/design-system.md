# Nabad design system: "Held"

Nabad should feel like a good clinic: calm, warm and human. Not an AI product, not a tech template. "Held" is the name of the identity: a cupped arc holding a dot, someone looked after.

**Do:** a soft neutral canvas, white surfaces, left-aligned text, generous space, clear actions and plain kind words. Spruce green is the identity colour: **green means Nabad, urgency is never green.**
**Say each thing once.** Calm comes from saying each thing once, with one clear action, not from saying it gently three times. Before you add a card, a button or a line, check the screen doesn't already say it; merge duplicates (never drop the content). One primary button per card or screen; everything else is a quiet text button, an icon button with a name, or the whole tile or row as a link. See [Say it once: the patterns](#say-it-once-the-patterns).
**Don't:** gradients, glow, glassy cards, sparkle icons, emoji as icons, 3D blobs, centering everything, boxes nested inside boxes.

Everything lives in three stylesheets (imported once in `frontend/pages/_app.js`) and a few components:

| File | What's in it |
| --- | --- |
| `frontend/styles/tokens.css` | Colors, font, type scale, spacing, radius, shadows (CSS variables) |
| `frontend/styles/base.css` | Defaults for `body`, headings, links, form controls, focus ring |
| `frontend/styles/components.css` | Classes used by the components below |
| `frontend/components/ui/` | `Button`, `Input`, `Card`, `Alert`, `Badge`, `EmptyState`, `PageLayout`, `PageTitle`, `MoreMenu`, `InlinePanel`, `HeldMark`, `BreathingDot`, `HeldIcon`, `Timeline`, `NumText` |
| `frontend/public/fonts/` | "Nabad Digits": Inter's digits only (see [Numbers and the zero](#numbers-and-the-zero)) |
| `frontend/components/illustrations.js` | The five line drawings |

**Rule of thumb:** a new page should need no `style={{...}}` and no hex colors. If you need a color or a size, use a token (`var(--color-primary)`, `var(--space-4)`). If you need something new, add it to the system rather than to your page.

---

## Signed-in page template

Every signed-in page follows the same frame, so the app reads as one product:

```
┌ header (74rem) ─────────────────────────────────────────────────────────────┐
│ My vitals                                              [Log reading] [More ▾] │  ← PageTitle: title + one-line lead left,
│ ━━•                                                                           │    one primary action and More right
│ Log measurements and see how they change over time.                           │    (stacked on phones)
│ ───────────────────────────────────────────────────────────────────────────── │
│ ┌ card ─────────────────────────────────────────────────────────────────────┐ │  ← data first: the list, history or
│ │ History and trends ...                                                    │ │    empty state, in the dashboard's card
│ └───────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

1. **One width.** `PageLayout` gives every page with a header the 74rem column (`container--wide`), so content lines up with the header's left and right edges. Don't pass `width` on a signed-in page.
2. **Header row.** `PageTitle` takes the title, a one-line `lead`, the page's single primary `action` and an optional `more` (`<MoreMenu />`) for the secondary actions. Longer explanations go in a `.page-intro` paragraph under it.
   ```jsx
   <PageTitle lead="Keep your doctor's appointments together."
     action={<Button onClick={openForm}>Add appointment</Button>}
     more={<MoreMenu id="appointments-more" items={[canAsk && { label: "Get pop-up reminders on this device", onClick: ask }]} />}>
     My appointments
   </PageTitle>
   ```
   Show the primary action once the page's data has loaded (an add form opened before then would be reset). Pages whose sections each have their own Add (My health) or that are tools (Find care, Symptom check) have no header action. Medication overview's primary action is **Print for handover**; Visit preparation's is **Share with a doctor**, with More beside it. The menu already links every page, so a page has no "Back to ..." button.
   The page's description is the `lead`, directly under the title (Notifications, My profile). Notes that belong to one part of the page go in that part's card instead of floating under the title: My appointments' reminder sentence sits in the calendar card, and Find care's "Saved providers belong to your account..." sits with the directory note above the results.
   **Primary add buttons are text only, with no "+" or other icon** (Add medication, Add appointment, Log reading, Add documents). The label already says what happens, and one style keeps the header rows identical. Don't add an icon to one of them; if icons are ever wanted, add the same one to all of them in the same change.
3. **Cards.** Page content sits in the same `Card` the dashboard uses (see [Card](#card)); several short sections go in a two-column `card-grid`.
4. **Data first.** The list or history (or its empty state) comes first. The primary action opens the form in an `InlinePanel` just under the header row:
   ```jsx
   {open && <InlinePanel id="log-vitals" title="Log a reading" onClose={close} returnFocusTo={buttonRef}>...form...</InlinePanel>}
   ```
   The panel is a labelled card (a region named by its h2) with a spruce edge. Opening it moves focus to its first field; Escape and Cancel close it, and focus goes back to the button that opened it (also after saving). The opening button has `aria-expanded` and `aria-controls`.
   - **My vitals:** History and trends first; **Log reading** opens the form. More: Review vitals before a visit.
   - **My documents:** the list first (the card has its heading only; the page's lead already describes it, including "Any file type up to 10 MB each"); **Add documents** opens the file picker, and the panel then asks for the type and date of the chosen files ("Details for 2 files", "Upload 2 files"). Files are checked (count, empty, 10 MB) before the panel opens. More: Attach documents to visit preparation.
5. **Empty states** use the one `EmptyState` component.

A short form keeps its 28rem width inside its card. On a page of short sections, the card grid puts two cards side by side from 64rem, so the wide column never looks half empty.

## Layouts

### Phones and tablets (under 64rem, 1024px)

The header and the bottom tab bar, as they were before the Held refresh: under 40rem the header has the logo, a search button (it opens the search field) and the bell, and the tab bar has Symptom check, Dashboard, Find care and Menu; from 40rem the header has the search field and the workspace row with the My care and My records dropdowns.

**The phone emergency button:** on every signed-in page without the desktop sidebar (under 64rem), a compact red **140** (`tel:140`, named "Call 140, Lebanese Red Cross emergency", `.header-call`) sits right before the bell. On desktop the sidebar's **Emergency · 140** button takes its place. The emergency call is never more than one tap away.

**Today (the dashboard), in this order:**

1. The date (muted) and the greeting, "Good morning / afternoon / evening, <first name>" in Beirut time (800 weight, 36px; 48px on desktop).
2. **The symptom card**: deep spruce (`--color-primary-strong`), "Something feels off?", "Answer a few questions. We'll tell you where to go.", a resting Held mark (paper arcs, `--color-pulse-on-dark` dot), one light full-width button **Check a symptom**, and **Or speak instead** (`/symptoms?voice=1`, named "Speak your symptoms").
3. **Next step** (`NextStepCard`): the time in a soft spruce chip, the line, and one primary button. While the first steps apply (their To do tags on Your health), Next step is hidden: never both.
4. **Your day**: one white card with two [meters](#your-day-meters), water and sleep, each a link to Water and sleep. Today's water and last night's sleep are said here and nowhere else on the dashboard.

Below the first screen:

5. **Your health** (`components/YourHealth.js`): [tiles](#tiles), six regular ones in an even grid (2 columns on phones, 3 from 40rem, so rows are always full): My health ("0 of 5 basics"), Medicines ("1 of 2 taken today", "All taken today", "No active medicines"), Appointments (the next one, its date, time and place), Vitals ("Log a reading"), Documents ("Upload or view") and Symptom checks ("No checks yet", "3 saved"). Then the **Emergency card** as one full-width special tile: white with a soft danger outline, a danger-soft icon square, "Your key info for a doctor, even offline". It replaced Getting started, Your progress and Quick actions: the first steps that aren't done carry a small **To do** tag (its hidden text names the step), and the heading row shows a small **setup ring** (pulse green on a stone track), "Setup 2/4" and a quiet **Hide**; when everything is done the ring and the text go. Under the grid, one quiet text button checks off the next medicine ("Mark taken: Aspirin").
6. **The wellbeing card** (`components/WellbeingCorner.js`): soft green (`--color-primary-soft`). The label **Wellbeing**; the two helplines in ONE white block, two rows (the name, "24/7 · verified <date>" or for the Red Cross "Emergency · verified <date>", a small "Official source" link, and the number itself as the call button: **1564** in spruce, **140** in danger); then **Two minutes to breathe** as the hero (the [breathing dot](#the-breathing-dot) in three still primary-soft rings, "In for 4, hold for 4, out for 6", one spruce **Start**); then today's message as a quoted line; the tips and notes under **More**. **The helplines come first, before the breathing**: the self-harm result links to this card, and `__tests__/wellbeingExercises.test.js` keeps them first. The four calm exercises and the question of the day are on /wellbeing only.

The emergency call appears once on the dashboard (the sidebar's **Emergency · 140** on desktop, the Red Cross row everywhere), plus the footer line.

### Desktop (64rem and up)

```
┌ sidebar 16rem ┐┌ header: search · bell · Acting for · account ──────────────────────┐
│ nabad         ││ Tuesday 24 November                                                  │
│ Symptom check ││ Good evening, Maya                                                   │
│(Dashboard)    ││ ┌ symptom card (deep spruce, mark 190px) ┐ ┌ Next step ──────────┐ │
│ My care     ▾ ││ │ Something feels off?          ( • )    │ │ Your day: pills     │ │
│ My records  ▾ ││ │ [Check a symptom]                      │ │                     │ │
│ Health assist.││ └────────────────────────────────────────┘ └─────────────────────┘ │
│ Find care     ││ ┌ Recent checks ─ See all ───────────────┐                          │
│               ││ │ runny nose   24 Nov 2026     [Routine] │                          │
│[Emergency·140]││ └────────────────────────────────────────┘                          │
│ (MP) Maya     ││ Your health (6 tiles, 3 a row, + Emergency card) · Wellbeing (green)│
└───────────────┘└──────────────────────────────────────────────────────────────────────┘
```

- **Sidebar** (`AppHeader.js`, from `useDesktopLayout()`: 64rem of the page's own text size, so with text at 200% a 1280px window keeps the phone and tablet layout instead of overflowing): stone (`--color-sunken`), 16rem, stays in view while the page scrolls. The logo, then the same "Workspace" navigation as the header row it replaces (same links, routes and My care / My records disclosures, now in a column with icons; the current page is a spruce pill), then **Emergency · 140** (`tel:140`) and the signed-in person, linking to My profile. Search, notifications, "Acting for" and the account menu stay in the header's top row. The phone tab bar isn't rendered at this width.
- **Today**: the greeting row, then two columns. Left (wider): the symptom card large and **Recent checks** (the last three checks as a [timeline](#timeline): the date, the words and the level chip; each row opens that check, "See all" goes to My history). Right: Next step and Your day. Below: Your health (three tiles a row, then the full-width Emergency card) and the wellbeing card.
- Every other page sits in the main area beside the sidebar, in its usual 74rem column.

## A new page in 30 seconds

```jsx
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import ProfileHeader from "../components/ProfileHeader";

export default function MedicinesPage() {
  return (
    <PageLayout header={<ProfileHeader />}>
      <PageTitle lead="Keep a list of what you take, so a doctor can see it quickly.">Your medicines</PageTitle>
      <form className="form" onSubmit={save}>
        <Input id="medicine" label="Medicine name" hint="As written on the box." error={errors.medicine} />
        {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
        <div className="form-actions">
          <Button type="submit">Save medicine</Button>
          <Button variant="secondary" onClick={cancel}>Cancel</Button>
        </div>
      </form>
    </PageLayout>
  );
}
MedicinesPage.requireSignIn = true;
```

---

## Colors

**Green means Nabad; urgency is never green.** Spruce is the brand: buttons, links, the logo. A medical level never uses it, so the brand never looks like a medical verdict and a routine result never looks like "Nabad says all clear".

Contrast is the WCAG 2 ratio against the paper background (`--color-bg`) unless noted. Text needs 4.5:1; control boundaries and graphics need 3:1. `__tests__/designTokens.test.js` checks every pair below.

| Token | Value | Use it for | Contrast |
| --- | --- | --- | --- |
| `--color-bg` | `#f6f4ee` | Paper: the page canvas | |
| `--color-surface` | `#ffffff` | Inputs, cards and dialogs | |
| `--color-sunken` | `#ece8de` | Stone: quiet inset areas | |
| `--color-text` | `#15281f` | Body text | 14.1:1 (12.7:1 on stone) |
| `--color-text-muted` | `#56655c` | Hints and secondary text | 5.6:1 (6.2:1 on white, 5.0:1 on stone) |
| `--color-placeholder` | `#66736c` | Input placeholders | 5.0:1 on white |
| `--color-border` | `#ddd8cb` | Dividers and card edges (decorative only) | |
| `--color-border-strong` | `#6f7f76` | Control outlines | 3.8:1 (4.2:1 on white, 3.5:1 on stone) |
| `--color-primary` | `#1d4434` | Spruce: primary buttons, links, icons, the logo arc | 9.9:1; white on it 10.9:1 |
| `--color-primary-hover` / `-strong` | `#12301f` | Hover, headings and green text | 12.1:1 on primary-soft |
| `--color-primary-soft` / `-line` | `#e4efe8` / `#b9d3c4` | Light green panels, info banners and their edges | |
| `--color-pulse` | `#2e9466` | The dot of the Held mark. **Graphics only, never text** | 3.4:1 |
| `--color-pulse-on-dark` | `#8fd8b4` | The dot on deep spruce (app icons) | 8.6:1 on `#12301f` |
| `--color-accent` | `#9c4a2f` | Muted terracotta. **Sparingly**: one highlight per screen at most | 5.6:1 |
| `--color-danger` | `#b3141a` | **Only** emergencies, errors and delete buttons. Red must always mean something. | 6.3:1; white on it 6.9:1 |
| `--color-success` | `#146c43` | Saved, done | 5.9:1 |
| `--color-warning` / `-strong` / `-soft` | `#b47f10` / `#5a3d00` / `#fcefcb` | Warm amber: "See a doctor soon" and needs-attention borders / text | graphic 3.5:1 on white, 3.2:1 on paper, 3.1:1 on soft; text on soft 8.7:1 |
| `--color-urgent` | `#c2410c` | Symptom urgency level "urgent" only | 4.7:1 |
| `--color-routine` | `#2f5a86` | Slate blue: symptom urgency level "routine" only | 6.5:1 |

Colors have `-strong` (text on the soft background) and `-soft` (background) variants where needed. High contrast mode overrides the shared palette, including the routine colours.

**The wellbeing lilac is retired** (phase 3). Breathing, sleep and the Wellbeing Corner use the neutral surfaces: a stone card (`--color-sunken`) or white, spruce text and actions (`--color-primary-strong` on stone 11.7:1, `--color-primary` on stone 8.9:1) and the pulse-green breathing dot (`--color-pulse` on white 3.8:1, a graphic). There are no `--color-wellbeing*` tokens; `__tests__/heldRefreshPhase3.test.js` checks none come back.

### The urgency scale

Each level has its own three tokens. Colour is never the only signal: every result writes its label once ("Urgency: Routine / self-care") with its timeframe ("How soon: ..."), and level chips always carry the label.

**Colour is an accent, not a flood** (phase 3.2). Only an **Emergency** fills its result card with its colour (danger-soft, with the still urgent mark). Routine, soon and urgent use a white card with the level as an accent: a 4px top edge in the level colour, the **level chip**, a small ring, the action in ink, and only the current scale segment coloured (the others neutral stone, `--color-border`).

**The level chip** (`.level-chip.level-chip--<level>`, the result header, the timeline, Recent checks and history): the level's soft background, its dark `-strong` text, and a small dot in the level colour (`::before`); no border (a 1px outline in forced-colors mode).

**Soon is a warm amber.** The brief's starting amber `#C48A12` is exactly 3.0:1 on white but 2.7:1 on paper and 2.6:1 on its new soft, so it is darkened only as far as needed for every 3:1 pair: `#b47f10` (3.5:1 on white, 3.2:1 on paper, 3.1:1 on `#fcefcb`). Chip text `#5a3d00` on `#fcefcb` is 8.7:1 (10.0:1 on white). `__tests__/designTokens.test.js` checks each, plus every level's colour on white for the dots and the scale segment.

| Level | Border, bar | Text | Background | Text on background |
| --- | --- | --- | --- | --- |
| Emergency | `--color-danger` `#b3141a` | `--color-danger-strong` `#8a1015` | `--color-danger-soft` `#fdecec` | 8.5:1 (white on `#b3141a`: 6.9:1) |
| Urgent | `--color-urgent` `#c2410c` | `--color-urgent-strong` `#7c2d12` | `--color-urgent-soft` `#ffede0` | 8.2:1 |
| See a doctor soon | `--color-warning` `#b47f10` (borders and graphics only) | `--color-warning-strong` `#5a3d00` | `--color-warning-soft` `#fcefcb` | 8.7:1 |
| Routine / self-care | `--color-routine` `#2f5a86` | `--color-routine-strong` `#1f3f60` | `--color-routine-soft` `#e6eef6` | 9.3:1 |

## Typography

**Atkinson Hyperlegible Next** for every letter, in body text and headings (400, 700 and 800), loaded with `next/font` in `_app.js` (self-hosted, so the browser sends no request to Google), and **Inter's digits** for every number ("Nabad Digits", below). You don't need to set a font anywhere: `body` has both through `--font-sans`.

Why Atkinson: the Braille Institute designed it for readers with low vision. It keeps look-alike characters distinct (`I l 1`, `0 O`), which matters when the text is a dose: 1 mg and l mg, or 10 and 1O, must never be confused.

### Numbers and the zero

Atkinson Hyperlegible Next and Mono only have a slashed zero: no `zero`, `ss01` to `ss08`, `cv01` to `cv05` or `salt` alternate removes the slash, so "140" read as "14Ø" (and the Red Cross number is the one number that must never be misread). So every digit comes from **Inter 4.1**, which has a plain zero, and every letter stays Atkinson:

- `styles/base.css` declares **"Nabad Digits"**: Inter's 0-9 only (`unicode-range: U+0030-0039`), subset to about 1.5 KB per weight, self-hosted in `public/fonts/` with Inter's licence (SIL OFL). It is first in `--font-sans`, so every number in the app switched without markup changes.
- Three faces follow Atkinson's own weight steps (it has 400, 700 and 800, so CSS 500 draws as 400 and 600 as 700): Inter Medium answers up to 549 (Inter Regular is lighter than Atkinson Regular), Inter Bold 550 to 749, Inter ExtraBold from 750. A separate SemiBold face looked lighter than the letters next to it at 600, so there isn't one.
- `size-adjust: 93%` matches Inter's digit height (0.747 em) to Atkinson's (0.694 em), so digits sit at the height of the letters around them.
- Only digits: `.`, `,`, `:` and `/` stay Atkinson's (they sat well next to Inter digits in the comparison, so they weren't added to the range).
- Atkinson Hyperlegible Mono is gone (nothing else used it). There's no `slashed-zero` anywhere.

**Numbers people act on** get `.num`: tabular figures (`font-variant-numeric: tabular-nums`), same font and size. Wrap only the number and its unit ("5 mg", "20:00", "0.8 L", "7.5 hours"), never a whole date ("24 November 2026") or a label ("not logged", "0 of 4 done"). In a sentence use `<NumText>` (`components/ui/NumText.js`): it finds numbers with their unit and times, wraps them in `.num`, and gives screen readers (and tests) the whole sentence once as one text. Where an element holds only a number, put `.num` on it (the drink log, the breathing countdown, the Medication overview's Dose and Times, Your day's pills).

| Token | Size | Use |
| --- | --- | --- |
| `--text-3xl` | 36 to 48px (fluid) | Landing headline only |
| `--text-2xl` | 28 to 36px (fluid) | `h1` |
| `--text-xl` | 24px | `h2` |
| `--text-lg` | 20px | `h3`, lead paragraphs |
| `--text-base` | 16px | Body text |
| `--text-sm` | 15px | Hints, footnotes |

Body text is never below 16px, and **no text is below 13px** (`--text-xs`): tags, badges, calendar events, the map's attribution and print footers included; a `<small>` never shrinks below it (`small { font-size: max(var(--text-xs), 0.875em) }` in `base.css`). Line height is 1.6 for text and 1.25 for headings. Headings are bold (`--weight-semibold`, 700), in `--color-primary-strong`. Only the wordmark uses 800.

**Weights: 400, 700 and 800 only**, the three Atkinson weights that are loaded. Links, menu items, tags and badges are regular (400); headings and emphasis are 700. There is no medium (500) or 600: they used to round to 400 or 700 anyway. `__tests__/heldRefreshPhase32.test.js` checks every weight and every font size in the stylesheets.

**Use `rem`, never `px`.** The text-size setting (#20) will change the root font size, and everything in rem grows with it. `1rem` = 16px by default.

## Spacing, shape, shadow

- Spacing: `--space-1` (4px) `-2` (8) `-3` (12) `-4` (16) `-5` (24) `-6` (32) `-7` (48) `-8` (64) `-9` (96).
- Radius: `--radius-sm` (8px), `--radius-md` (12px, buttons and inputs), `--radius-lg` (18px, cards and dialogs).
- Shadows: `--shadow-sm` gives grouped surfaces a light lift; `--shadow-overlay` is for menus and dialogs. Pair these with a thin border.
- Widths: header, every signed-in page and the landing page `--width-wide` (74rem); sign-in and info pages `--width-content` (62rem); forms `--width-form` (28rem); paragraphs `--width-prose` (38rem). Legal pages use a 46rem reading column.
- Side margins: `--page-gutter` is 16px on phones and 32px from 640px up. `PageLayout` applies it, so content never touches the screen edge.

## Accessibility built in

- Every button and input is at least **44px** tall (`--tap-target`).
- **Keyboard focus** shows a 3px spruce outline on everything (`:focus-visible` in `base.css`). Don't remove it.
- Every page has a "Skip to main content" link (it appears when you press Tab).
- Colors meet AA; color is never the only signal (errors and urgency levels are always written out).
- Animations stop when the user turns on "reduce motion" (see [Motion](#motion)).

Signed-in pages use the header's 74rem column while forms keep their 28rem maximum (see [Signed-in page template](#signed-in-page-template)). Your health's tiles use two columns on phones, three from 40rem and four with the desktop sidebar; water and sleep sit side by side from 56rem. Document rows and their metadata editors wrap into compact grids. Avoid fixed flex bases when changing a row into a column: the basis becomes a height and can create large empty gaps. Preserve visible labels, consent text, keyboard focus, and the existing print-specific layouts when refining a screen.

---

## The Held mark

The logo and Nabad's one moving element. A cupped arc holds a dot: someone held, looked after. The shape is also the Arabic letter noon (ن), the first letter of the name in Arabic (نبض, "pulse").

**Logo** (`components/Logo.js`, props `size` and `href`): on a 160 grid, the arc `M24 74 A56 56 0 0 0 136 74` (stroke 17, round caps, `--color-primary`) and a dot (cx 80, cy 64, r 19, `--color-pulse`), then the wordmark "nabad" in lowercase, weight 800, letter-spacing -0.03em, `--color-text`. The link is named "Nabad"; the drawing is `aria-hidden`. On the first load of the app the dot drops in (10px, 500ms, `cubic-bezier(.23,1,.32,1)`), then beats slowly (scale 1 to 1.18, 2.4s); the beat pauses while the tab is hidden.

**App icons** (`frontend/public/`): the mark on a deep spruce (`#12301f`) rounded square (rx 36 on 160), arc in paper `#f6f4ee`, dot `#8fd8b4`. The 16 and 32px favicons use a bolder mark (arc 22, dot r 22). `apple-touch-icon.png` is a full square because iOS rounds the corners itself. `site.webmanifest`: theme `#12301f`, background `#f6f4ee`. `og-image.png` (1200 by 630): paper, the Held logo large with "nabad", and "Find the right care, at the right time." in Atkinson Hyperlegible Next.

**HeldMark** (`components/ui/HeldMark.js`): two open arcs around a dot, `<HeldMark state="..." />`. Decorative (`aria-hidden`) unless it gets a `title`; always write what it means next to it.

| State | What moves | Where |
| --- | --- | --- |
| `resting` | The dot beats slowly (2.4s) | The Nabad assistant (onboarding, the symptom-check history's empty state, the health assistant greeting), the dashboard's symptom card |
| `thinking` | The arcs turn around the dot (1.4s a turn, `cubic-bezier(.5,0,.5,1)`) | The symptom check while it runs: `<HeldLoader label="Checking your symptoms" size="8.75rem" />` (role `status`, visible text). The only animated loader |
| `done` | A full ring draws closed once (600ms, ease-out), in the level's colour | The header of a routine, see-a-doctor-soon or urgent result |
| `urgent` | Nothing: arcs and dot in `--color-danger`, completely still | **Only** on an emergency result |

### One mark per screen

The Held mark appears **at most once per screen besides the logo**. On the dashboard that one is the symptom card; on a result, the header's ring or still urgent mark (the level's icon and the scale's icon are gone); on the landing page, the sample result's ring (the hero shows the logo mark, not a Held mark). Breathing isn't a mark state: it's [the breathing dot](#the-breathing-dot). `__tests__/dashboard.test.js` checks the dashboard.

**The logo mark alone** (`LogoMark` in `components/Logo.js`): the noon arc and dot without the wordmark, large, with the same first-load drop and slow beat. The landing hero uses it (paper on deep spruce from 64rem).

### The breathing dot

`components/ui/BreathingDot.js`: breathing is shown by the Held dot alone, no arcs. A pulse-green dot (`--color-pulse`), about 18px at rest (14 to 20px), grows to about twice its size and shrinks back on the exercise's real timing: in for 4 seconds, hold for 4, out for 6 (one 14-second round). Only `transform` animates; with reduced motion it stays still (and the exercise shows its steps as text). `phase="in" | "hold" | "out"` follows the running exercise step by step (`paused` freezes it); without a phase it runs the 14-second cycle on its own. Decorative: "In for 4, hold for 4, out for 6" is always written next to it.

`BreathingRings` puts the dot inside three still, soft primary-soft rings (only the dot moves). Used on /wellbeing (the lead card and the running exercise) and on the dashboard's wellbeing card ("Two minutes to breathe"). Nowhere else; never on a result.

### The page title bar

Under every page title (`PageTitle`, and the landing headline through `TitleBar`): a static 28 by 3px spruce bar ending in a 6px pulse dot. It replaced the heartbeat line; `components/ui/Heartbeat.js` is gone.

```jsx
<PageTitle lead="Optional short sentence under the title.">Your medicines</PageTitle>
```

### Kept as it is for now: the offline page

`public/offline.html` (the page the service worker shows when Nabad can't connect) keeps its pre-Held colours and fonts. The service worker serves it cache-first under `nabad-public-help-v2`, so a restyle also means a new cache version and a careful check of the offline emergency path (`public/service-worker.js`, `offline-emergency.js`). That page exists to show 140 when nothing else loads; it isn't worth touching for looks alone. Restyle it together with a planned service-worker change.

## Motion

1. **Emergency never waits.** An emergency result renders at once: no entrance animation, no delay, no transition (`__tests__/heldRefresh.test.js`). Other results may fade in once (`urgency--enter`, 200ms, ease-out, never more than 240ms).
2. **Interface motion is 150 to 250ms, ease-out** (`--duration-enter`, `--ease-out`).
3. **Things people see often barely move.** An entrance plays once per visit, not on every return.
4. **Only the Held mark moves on its own.** Nothing else loops, pulses or moves to draw attention.
5. **Only `transform` and `opacity` animate** (the `done` ring's `stroke-dashoffset` is the one exception). With `prefers-reduced-motion` everything is still: the logo dot doesn't drop or beat, and every Held state is static. The `urgent` state is still for everyone.

### The Nabad assistant

The illustrated mascot ("Pulse peek") is **retired** (Held refresh, Phase 2). `components/NabadAssistant.js` keeps its props, so its callers didn't change, but it now draws the resting Held mark:

```jsx
import NabadAssistant from "../components/NabadAssistant";
<NabadAssistant size="4.5rem" title="Nabad assistant" />   // the resting Held mark, named "Nabad assistant"
<NabadAssistant size="3rem" crop="head" />                 // crop is kept for compatibility; without a title it's decorative
```

- `size` sets the mark's size, `title` its accessible name (role `img`), and `tracing` shows the thinking state. `AssistantLoader` is gone: the loader is `HeldLoader`.
- **Only in calm places:** onboarding (step 1), empty states (the symptom-check history) and the health assistant greeting.
- **Never** on urgent or emergency results, next to the emergency dialog, on the emergency card (or its offline copy), or on any "Call 140" screen or bar. The symptom check hides it as soon as a result is urgent or an emergency.
- Next to the assistant, keep the existing wording "Nabad gives guidance, not a diagnosis."

---

## Say it once: the patterns

Phase 3 of the Held refresh. The app used to repeat the same information two or three times and put the same outlined button everywhere. These patterns say each thing once, with one clear action.

### Tiles

`components/YourHealth.js` (`.tile-grid`, `.tile`). A grid of small tiles, each **an icon in a small primary-soft square, a title and ONE status line**, and **the whole tile is the link**: no buttons inside a tile, ever. The status line says one fact once ("0 of 5 basics", "1 of 2 taken today", "None coming up"); it may wrap to two lines, never an ellipsis. A small accent tag ("To do") may sit in the corner. **The grid rule: an even number of regular tiles, so every row is full** (six: 2 columns on phones, 3 from 40rem and on desktop), **then at most one full-width special tile** (`.tile-grid__item--wide`), here the Emergency card in a soft danger outline. An action that isn't "go there" (checking off a medicine) is a quiet text button under the grid, not in a tile. `__tests__/dashboard.test.js` checks there's no button in a tile and at most 7 buttons on the dashboard (there were 19).

### Icons

`components/ui/HeldIcon.js`: one line set in the Held hand, 24 grid, **2.2px strokes, round caps and joins**, no fills (the bookmark fills when saved). Tiles, the landing cards, the timeline, the result's quiet buttons, the provider cards and the header search use it. Decorative: the link or button always has a visible label or an `aria-label`. Use these instead of drawing a new thin-line icon.

### Your day meters

`pages/dashboard.js` (`.your-day__card`, `.day-meter`). One white card with two meters, each a link to Water and sleep: the label, the value (numbers through the digits font, tabular) and, when there is something to measure against, a thin pulse-green bar on stone (decorative: the value says the same).

- **Water:** "0.8 of 2 L" with the bar filling toward the daily goal ("0.9 of 1.5 L limit" for a limit, never encouraging more); without a goal "0.8 L today" and no bar; "Not logged" when nothing is logged.
- **Sleep:** last night's hours ("7.5 hours") on a 0 to 12 hour bar; "Not logged" when empty. No healthy-range band: Nabad defines no sleep target anywhere, and the dashboard doesn't invent one.

### Timeline

`components/ui/Timeline.js` (`.timeline`): one list style for things that happened. "Previous symptom checks" on /symptoms, the health story on /my-history and Recent checks on the dashboard. Each row: **the date** (normal font), **the person's own words on one line** (truncated; for other records, what it was and its detail), and **a chip**: a symptom check's level in that level's soft colours (`.level-chip`, also from the label alone, `LEVEL_BY_LABEL`), otherwise a quiet status (`.status-chip`, "Upcoming", "Planned"). **The whole row is the link.** No bullet points, no ▶ triangles, no underlined "Open..." links. A row without its own page (a saved conversation) expands with a **chevron button that has a name** ("Conversation from 24 November 2026, 09:30", `aria-expanded`). A link to `/symptoms#check-<id>` opens and scrolls to that check. A kind ("Symptom check", "Appointment") is said to screen readers before the date, with an icon for the eye in the health story.

### Provider cards

`pages/providers.js`, `ProviderBadges` and `ProviderCaveats` in `components/ProviderFacts.js`.

- **Phones (under 48rem):** only the name search, a **Filters** button with the number of active filters ("Filters 3", named "Filters 3 active", `aria-expanded`) and Search; Filters opens type, specialty, city, the checkboxes and More filters under them, so the first result starts on the first screen. Use my location and Show map stay at the top.
- **The page:** Use my location and Show map at the top right; the filters in **one row** above the results (search, type, specialty, city, Search), then the toggles (24/7 emergency, open now, saved) and the result count; **More filters** opens a panel under the row (district, governorate, service, insurance, distance). Desktop never has three columns. The directory notes are one muted line ("From published sources. Call to confirm before travelling.") ending in **About this data**, which holds the same notes in full. Signed out, the header is the landing page's (Find care, Log in, Sign up).
- **A card:** the bold name (not underlined) is the card's header and the link to every detail on the facility's page (it replaced "More details"); type, city and distance in muted text; status chips (open per published hours, 24/7 ER, driving time); and, never hidden, the caveats: information that may be outdated, an approximate pin, an address or map location that isn't verified.
- **ONE primary action:** Directions once your location is known, otherwise Call. The other is an icon button with a name ("Call <name>", "Directions to <name> in Google Maps"); Save is a bookmark icon button ("Save <name>", `aria-pressed`); Compare is a checkbox labelled "Compare" (named "Compare <name>"). `__tests__/providers.test.js` checks one primary action per card.

### Result anatomy with always-visible red flags

See [Symptom check result](#symptom-check-result): one mark, the level once, the red flags in their own block under the header (never in a disclosure), one card of disclosure rows for secondary detail, one primary button.

## Components

### PageLayout

The frame of every page: header, then content in a centered column with proper side margins. Text inside stays left-aligned.

```jsx
<PageLayout header={<ProfileHeader />}>...</PageLayout>   // signed-in pages with the profile switcher
<PageLayout>...</PageLayout>                              // logo-only header (sign-in pages, onboarding)
<PageLayout variant="auth">...</PageLayout>               // centered sign-in or account recovery panel
<PageLayout variant="prose">...</PageLayout>              // legal reading column
<PageLayout width="wide" header={<SiteHeader width="wide">links</SiteHeader>} footer={<p>...</p>}>  // landing
```

Don't render your own `<main>`; `PageLayout` does (with `id="main"` for the skip link). It also adds the favicon, the meta description and the link preview (Open Graph) tags.

Give every page a `title`: `<PageLayout title="My profile">` shows "My profile · Nabad" in the browser tab. Only the landing page leaves it out (it gets "Nabad: know where to go when it matters").

`ProfileHeader` reads the active profile from the `ActiveProfileProvider` in `_app.js`. Without the provider (in some tests) it still renders, just without the profile switcher.

### Signed-in header

Every signed-in page uses `<ProfileHeader />`. It draws the header bar (`components/AppHeader.js`) and, when acting for a family member, the "Acting as" banner. The profile picture and "Upload picture" are not in the header: they sit in My profile's Account owner card (`components/ProfilePicture.js`, the account owner's picture), and while acting for a family member their picture sits in the Linked profiles card ("Picture for Maya").

```
Desktop   [Nabad]  [Search]                                                 [Bell] [Profile ▾] [(RH)▾]
          Symptom check  Dashboard  My care ▾  My records ▾  Health assistant  Find care
                                                                                      My profile
                                                                                      Account security
                                                                                      Sign out
Phone     [Nabad] [Search]                                                            [Bell]
          ...page...
          ┌ Menu sheet (opened by the Menu tab): My care · My records · ... · Acting for [▾] · Sign out ┐
          [ Symptom check ][ Dashboard ][ Find care ][ Menu ]      <- bottom tab bar, fixed
```

- **Workspace navigation** (`NAV_ITEMS` in `AppHeader.js`) is **one row** below the desktop account bar: Symptom check (always first), Dashboard, the **My care** dropdown (My appointments, My medications, Medication overview, Water and sleep, Wellbeing), the **My records** dropdown (My health, My vitals, My documents, Visit preparation), Health assistant and Find care. The phone menu shows the same items in the same order, with My care and My records as labelled groups. A new page goes into one of the groups rather than adding a seventh item to the row.
- **Dropdowns** are disclosure buttons (`aria-expanded`, `aria-controls`), not ARIA menus: links stay links. Enter or Space opens one and focuses its first link; Down/Up move between links (on the closed button they open it at the first/last link), Home/End jump, Escape closes it and returns focus to the button; a click outside or tabbing out closes it. When one of its pages is open, the group button gets the current-page style and the name "My care, current section", and the link inside has `aria-current="page"`.
- **One name per page.** A link's label is exactly the page's `<title>` and `<h1>` (for example "My medications", "Symptom check"), also in simplified mode. Personal records use "My …" (My health, My vitals, My medications, My appointments, My documents, My profile); tools keep plain names (Symptom check, Visit preparation, Health assistant, Find care, Water and sleep, Wellbeing). For a linked profile the title names them instead ("Vitals for Rania"). The dashboard doesn't repeat the menu as tiles; its quick actions are equal icon tiles with one-line labels.
- **Say it once.** A page doesn't repeat what the header or another page already offers. The dashboard keeps the Next step card (or the first steps' To do tags, never both), the symptom card, Your day, Your health (one grid of tiles) and one stone Wellbeing Corner (today's message, the two helplines, two minutes to breathe; tips and notes under "More"). Apart from the footer line, 140 appears once per page. See [Say it once: the patterns](#say-it-once-the-patterns).
- **Chips state known facts only.** Find care cards show driving time, open/closed per published hours and the 24/7 ER status only when known (distance is in the muted meta line); unknown hours or ER status get no chip, and "About this data" explains why. What a card never hides: "Information may be outdated" and an unverified address or map location (`ProviderCaveats`). "Show map" sits at the top right with "Use my location"; "Estimate driving times" is a quiet button above the results.
- **Right side:** the profile switcher, then the **account menu**: a round button with the user's initials that opens My profile, Security and Sign out (`ACCOUNT_LINKS`). New controls such as a notifications bell go on the right, before the account menu. At 1280px there is plenty of room.
- **Phones (under 40rem / 640px):** the top bar has the logo, search and the bell; navigation moves to the **bottom tab bar** (below).
- **Bottom tab bar** (`components/BottomTabBar.js`, phones only): fixed to the bottom, four equal tabs: **Symptom check, Dashboard, Find care, Menu** (`TAB_LINKS` in `AppHeader.js`). Rules:
  - Every tab has an icon above a text label (never icon only) and is at least 44px tall (`--tab-bar-height`, 3.75rem).
  - It is its own landmark, `<nav aria-label="Quick links">`, after the header. The current page's tab gets `aria-current="page"` (spruce text, light green fill and a spruce bar on top). On any page that lives in the menu, Menu gets the current style and the name "Menu, current section".
  - **Menu** is the phone menu's disclosure button: it opens a sheet just above the bar (scrolls on its own, at most the screen minus 4rem) with every link (My care and My records as labelled groups), "Acting for", the account links and Sign out. Keyboard and close behavior are the same as the other menus.
  - **Never cover content:** pages get bottom padding equal to the bar's measured height (`--tab-bar-space`, set by the bar; the fallback is `--tab-bar-height` plus the safe area), so the footer and its 140 link stay visible. Anything sticky at the bottom (`.action-toast`) sits above the bar. A new bottom-fixed element must do the same.
  - **Hidden** from 40rem (tablets and desktop keep the header row) and on paper (`@media print`: emergency card, medication overview, doctor summary, report printouts). The offline emergency page (`public/offline.html`) is static and never has it.
  - Don't add a fifth tab: a new page goes in the menu.
- **iPhone safe areas:** the viewport uses `viewport-fit=cover` (`pages/_app.js`), so every full-width element pads by `env(safe-area-inset-*)`: `.container` (header, page content, footer) uses `max(var(--page-gutter), env(safe-area-inset-left/right))`, and the tab bar, staging banner and offline banner pad by the insets too. A new full-width element that is not inside `.container` needs the same padding, or its text can go under the notch in landscape.
- **From 40rem** the workspace row sits under the logo and account bar. It is one line on laptops and wide tablets; on narrow tablets or with very large text it wraps rather than scrolling.
- **Current page:** its link gets `aria-current="page"`, shown as light green with a spruce underline (never color alone). On My profile or Security, the account button gets a spruce ring.
- **Keyboard:** the account menu and the phone menu are disclosure buttons too (`aria-expanded`, `aria-controls`):
  - Opening a menu moves focus to its first item.
  - Tab moves through the items. Tabbing out, clicking outside, or pressing Escape closes the menu.
  - Escape also puts focus back on the button.
  - Use links for pages and a button for actions (Sign out). Don't turn these into ARIA `menu`s: they are lists of links. (Arrow keys in the workspace dropdowns are an extra, not the ARIA menu pattern.)

### Button

```jsx
<Button>Save</Button>                                   // primary: the main action. Usually one per screen.
<Button variant="secondary">Cancel</Button>             // everything else: Cancel, Back, Edit, Skip
<Button variant="danger-quiet" size="small">Delete</Button>  // Delete on a list row: red text and outline
<Button variant="danger">Yes, delete</Button>           // solid red: only the final step that deletes data
<Button href="/profile" variant="secondary">My profile</Button>   // a link that looks like a button
<Button size="small">Sign out</Button>                  // smaller text, still 44px tall
<Button block type="submit">Log in</Button>             // full width (single-column forms)
```

**Delete buttons:** rows in a list (vitals, medications, documents, appointments, notifications) use the quiet `danger-quiet` style. Solid red `danger` is kept for the final confirm step (inside the confirmation dialog) and the Danger zone, so solid red always means "this happens now". The "Call 140" buttons are not delete buttons and stay solid red.

`type` defaults to `"button"`, so pass `type="submit"` for form submit buttons. Navigation should be a link (`href`), not a button with `onClick`.

### Input

Label, optional hint, the control, and the error message under it. Hint and error are linked to the input for screen readers, and an error marks it invalid (red border).

```jsx
<Input id="phone" label="Phone" type="tel" hint="Include the country code if it's not Lebanese." error={errors.phone}
       value={phone} onChange={(e) => setPhone(e.target.value)} />
<Input as="select" id="relationship" label="Relationship">...options...</Input>
<Input as="textarea" id="symptoms" label="Symptoms" rows="6" />
```

Every input needs a visible label. Placeholders are examples, not labels.

Checkbox or radio: `<label className="check"><input type="checkbox" /> Remember this device</label>` (the whole row is the tap target). Group radios in `<fieldset className="choice-group"><legend>Question</legend>...</fieldset>`.

### Form layout

```jsx
<form className="form">           {/* one column, max 28rem, 24px between fields */}
  <Input ... />
  <Input ... />
  <div className="form-actions">  {/* primary first, then secondary */}
    <Button type="submit">Save</Button>
    <Button variant="secondary">Cancel</Button>
  </div>
</form>
```

Show a form-level error with `<Alert tone="danger" as="p" role="alert">` just above the actions.

### Alert / banner

```jsx
<Alert tone="success" as="p" role="status">Your profile is saved.</Alert>
<Alert tone="danger" as="p" role="alert">Could not save. Please try again.</Alert>
<Alert tone="warning" title="Check this.">...</Alert>
<Alert tone="info">...</Alert>
<Alert tone="note" title="Nabad is not a doctor.">...</Alert>   // terracotta accent, rare
```

The "Please verify your email" reminder is not an Alert: it is one slim `.verify-bar` line on the dashboard with a "Resend email" link (`components/EmailVerificationBanner.js`); the longer reason is the link's screen-reader description.

Use `role="alert"` for errors that need attention now and `role="status"` for calm confirmations. Leave `role` off for static text.

### Symptom check result

While a check runs, the submit button reads "Checking..." and is disabled, and a calm panel shows the thinking Held mark (about 140px) with "Checking your symptoms" (the only text in its `role="status"`), the person's own words (the first 120 characters) and a line that stays: "Can't breathe, chest pain, or fainting?" with a red **Call 140** button. No progress steps: we don't know how long a check takes. When the result arrives (or follow-up answers update it), the page scrolls the result into view (instantly with reduced motion), moves focus to its heading ("Urgency: ...") and announces one short line in a live region that is always on the page. Emergencies are the exception: the emergency dialog takes focus and the card keeps `role="alert"`.

The form folds into one line above the result: **You said: "<the words>" · Edit** (one line, truncated), with "Symptoms recorded for <name>." under it (the success alert merged into the line). Edit opens the form again with the words; **Check something else** at the end of the result opens it empty. Both put focus in the text box.

**Result anatomy** (`components/UrgencyResult.js`). Everything the engine returns is shown, said once, in order of importance:

1. **Header.** Routine, soon and urgent: a **white card with a 4px top edge in the level colour**; the level as a [level chip](#the-urgency-scale) inside the heading ("Urgency: " is said to screen readers before it, so the heading that gets focus still reads "Urgency: <label>"), "How soon: <timeframe>" beside it in muted text, ONE small `done` ring (2rem), then the engine's action as the main line in ink (700, 21px on phones, 26px from 40rem; "What to do:" is said to screen readers before it). An **emergency** keeps its full danger fill, the heading as plain text and the large still `urgent` mark. Along the bottom, the **scale bar**: four segments, the current one in the level colour, the others neutral stone. Visually only the bar: every step name, "This result", `aria-current="step"` and "Level 2 of 4: See a doctor soon" are for screen readers. It only displays the server's level; it never decides one.
2. For an emergency, **Call 140 now** (full width, red).
3. **Get help sooner if things change** (for an emergency, the one strong "don't wait" line): always visible, right under the header, in its soft danger outline. **Never collapsed, never shortened, also in simplified mode.** It is the only place on the result that lists the call-140 conditions.
4. **Follow-up questions**, when the engine asks any: the line "Answer the questions below to make this more accurate." and the questions right under it (the page passes them in as `followUps`), so they come before "Why we suggest this" and before the actions. Then "Updated using your answers." after a refined result, and for the self-harm rule "View mental health support".
5. **One white card of disclosure rows** (secondary detail only): **Why we suggest this** (open), **What the AI check noted** and **Self-care guidance** (closed). Their content is unchanged.
6. The disclaimer, then **Find care** as the one primary button (the providers link with the level's filters), **Read aloud** and **Print or save as PDF** as quiet text buttons with icons, and **Check something else**. Checks are saved to the history automatically, as before.

`__tests__/heldRefreshPhase3.test.js` checks the red flags are visible, outside every disclosure, before the details card, and listed once.

| Level | Mark | Header colours |
| --- | --- | --- |
| Routine / self-care | small `done` ring, drawn once, in `--color-routine` | white, routine top edge and chip |
| See a doctor soon | small `done` ring in `--color-warning` | white, amber top edge and chip |
| Urgent | small `done` ring in `--color-urgent` | white, urgent top edge and chip |
| Emergency | `urgent`: still, in `--color-danger` | full danger fill |

An emergency card appears instantly, with nothing animated anywhere on it ([Motion](#motion), rule 1; `__tests__/heldRefreshPhase2.test.js`). The other levels fade in once (200ms).

### Next step (dashboard)

`components/NextStepCard.js`, with the choice made in `lib/nextStep.js`. It's one short line and one button for the active profile ("Acting for"), picked from data the dashboard already loads (`components/useDashboardData.js`, shared with Your health so nothing is fetched twice). The first rule that applies wins:

| # | When | Line | Button |
|---|------|------|--------|
| 1 | A medication dose (its `times`) is due in the next 3 hours | Take Amlodipine 5 mg at 08:00 | Open medications |
| 2 | An appointment in the next 3 days (72 hours) | Cardiology check-up on Friday: prepare your visit ("today", "tomorrow" or the weekday) | Prepare visit |
| 3 | My health basics not all 5 filled in | Add your health basics for safer guidance | Open my health |
| 4 | No sleep logged today | Log last night's sleep | Log sleep |

- Nothing applies, or the data is still loading: the card isn't shown. It waits for every source, so it never swaps one line for another.
- Every time is Beirut time (`APP_TIME_ZONE`), whatever the device's time zone. A dose after midnight belongs to tomorrow, so ticking today's check-in doesn't hide it. A once-a-day medication already checked off today is skipped. With two or more doses a day the next dose still shows, because the check-in is one tick per day.
- For a linked profile the line names them: "Sami's Amlodipine 5 mg is due at 08:00", "Cardiology check-up for Sami on Friday: prepare the visit", "Add Sami's health basics for safer guidance", "Log Sami's sleep from last night".
- The line starts with a capital even when it starts with something the user typed ("checking on my date" becomes "Checking on my date today: prepare your visit").
- Plain reminders only, never medical advice. It sits under the greeting and the symptom card ([Layouts](#layouts)), and it is never placed above or instead of an emergency message.
- Looks like: a white card with a spruce left edge, a small "Next step" label (its h2), the line in large text with a dose time in a soft spruce chip ("at" stays in the sentence for screen readers), and one primary button.

### Getting started (dashboard)

`useFirstSteps` in `components/GettingStartedCard.js`, with the steps in `lib/gettingStarted.js`. For new or mostly empty profiles. Since phase 3 the steps are **To do tags on the Your health tiles** (My health, Medicines, Symptom checks, Emergency card), not a card of their own: say each thing once. **While they show, the Next step card doesn't**, so they never compete; until every source has answered, Next step's slot holds its placeholder.

| Step (the tile with its To do tag) | Done when (data the dashboard already loads) | Was |
|---|---|---|
| Add your health basics | All 5 My health basics are filled in | Open my health |
| Add a medication you take | At least one active medication (there is no "I take none" option) | Open my medications |
| Try a symptom check | At least one saved symptom check | Check symptoms |
| Set up your emergency information card | The card shows an emergency contact, a long-term condition or an allergy. Its blood type (a health basic) and medications (step 2) don't count, so the steps stay separate; a family member's card, which has no contact of its own, is completed by their conditions or allergies | Open the card |

- **Progress in words:** "First steps: 2 of 4 done" in the Your health header. A step that's done loses its tag; each tag's hidden text names its step ("To do: Add your health basics"). The four hints are one muted line under the header.
- **Gone for good** when the user presses **Hide**, or finishes all four on their own profile. Both set one flag on the account on the server (`gettingStartedHidden`, `POST /api/auth/getting-started/hide`), never in the browser, so it stays gone on every device and for every profile. Nothing about which steps were done is stored. Hide moves focus to the page title. While it is hidden, My profile's Account owner card offers **Show getting started again** (`POST /api/auth/getting-started/show` clears the flag); steps already done still show as done, and if all four are done on your own profile it goes again.
- **Acting for:** the steps are the active profile's and name them ("First steps for Sami", "To do: Try a symptom check for Sami"). Finishing a family member's steps hides them for that profile only, and doesn't set the account flag.
- **Calm:** "A few first steps, whenever you're ready." No streaks, no counts of days, no pressure. Only on the dashboard; never on the symptom check or an urgent or emergency result. If any of its sources can't load, the dashboard shows Next step instead.

### One primary action, and "More"

When a page has several actions, show the main one as the primary button and put the rest in a **More** button: `<MoreMenu id="..." items={[{ label, onClick } | { label, href }]} />` (`components/ui/MoreMenu.js`, built on `useDisclosure`: `aria-expanded`, Escape and outside click close it, focus goes to its first item). Falsy items are skipped, and with no items it renders nothing. Visit preparation: **Share with a doctor** (opens the sharing panel and focuses its first control) and **More** with Edit visit sheet, Print or save as PDF, and Export sheet with attachments, both in the title row. Its "Recent symptom checks" card shows the 5 newest with a "Show all (N)" toggle; the hidden ones stay in the page, so the shared doctor link, the export, the PDF and paper keep every check. My medications: **Add medication**, and More with Add from a prescription and Medication overview. My appointments: **Add appointment**, and More with Get pop-up reminders on this device (only while the browser can still ask). Styles: `.more-menu`, `.more-menu__panel`.

### Badge

A small calm label next to a heading. Never red: green informs, gray marks what is no longer current, amber asks for a second look.

```jsx
<figcaption><Badge tone="neutral">Sample</Badge> An example result</figcaption>
<Badge tone="neutral">Discontinued</Badge>   // gray, for things no longer current
<Badge tone="warning">Missing dose</Badge>   // amber, something worth checking (still not red)
```

### Card

The white surface the dashboard uses. On signed-in pages, **page content sits in cards**: one card per section (My health, My profile, Care circle), one card around a page's list (My medications, My appointments, My vitals, My documents, Notifications, with its filters inside the card), or one card per person (Medication overview). The page header row stays on the canvas, above the cards. Inside a card, rows are separated by thin lines or light borders, not by another shadowed card.

```jsx
<Card aria-labelledby="contact-heading"><h2 id="contact-heading">Emergency contact</h2>...</Card>
<Card as="div" className="page-card">...list...</Card>   // a page's main list; consecutive page cards get 24px between them
<Card tone="danger">...</Card>                          // destructive settings ("Danger zone")
```

**Card grid.** A page made of several short sections (My profile, My health) puts its cards in `<div className="card-grid">`: one column on phones and tablets, two from 64rem, so 28rem forms don't leave half of the wide column empty. Cards fill in reading order (left to right, then down). `className="card--full"` makes a card span both columns (long or wide content: Download my data, Danger zone, Suggestions to review, What Nabad's guidance takes into account); anything in the grid that isn't a card (alerts, the "knows you" bar) spans both columns too.

### Loading placeholders (skeletons)

`components/ui/Skeleton.js`. While a page's data loads, it shows grey shapes in the page's final layout instead of blank space or "Loading...", so nothing jumps when the data arrives.

**The rule:** every page that loads data uses these placeholders. The only animated loader is the Symptom check's (`HeldLoader`, the Held mark turning) while a check runs. Actions in progress (uploading documents, reading a prescription, searching the history) show one plain status line (`<p className="text-muted progress-note" role="status">Uploading documents...</p>`) next to their disabled button, without animation. Dialogs about an emergency keep their plain "Loading emergency contact..." line.

| Placeholder | Used on |
| --- | --- |
| `DashboardSkeleton`, `NextStepSkeleton`, `HealthTilesSkeleton` | Dashboard (Your health shows its tiles placeholder until its data has arrived) |
| `MedicationsSkeleton`, `AppointmentsSkeleton`, `DocumentsSkeleton`, `VitalsSkeleton`, `HealthSkeleton`, `ProvidersSkeleton` | My medications, My appointments, My documents, My vitals, My health, Find care |
| `MedicationOverviewSkeleton` | Medication overview |
| `CardsSkeleton` (`grid` for a card grid, `title` to hold the page title too) | My profile, Care circle, Water and sleep, Visit preparation, Emergency card, the shared visit sheet, joining a care circle, provider details, the team dashboard, and the sign-in check (below) |
| `RowsSkeleton` | Notifications (inside its card) |
| `LinesSkeleton` | Content loading inside a card that is already shown: Account security, Emergency contact, Identification and coverage, Notification settings, the Health assistant's saved chats, the bell's list, Visit preparation's documents, the water and sleep summary, provider contributions, the email link check |

```jsx
{medications === null && <MedicationsSkeleton label="Loading medications..." />}
```

**While sign-in is checked:** a page that needs sign-in (`RequireSignIn`) shows `CardsSkeleton` until the server answers, never a blank page or the login page. Only a 401 ("not signed in") sends the visitor to `/login?next=...`. Any other failure (no connection, a timeout, a server waking up, a 5xx or 429) is tried again after 1, 3 and 8 seconds while the placeholder stays; if it still fails, the page says "We couldn't check that you're signed in..." with **Try again**, and never sends a signed-in user to log in again.

- **One announcement:** the region has `aria-busy="true"` and one visually hidden `role="status"` line with the page's loading text. The shapes are `aria-hidden` and contain nothing focusable, so a screen reader hears "Loading" once, not once per shape. A placeholder that only holds a place for another region's loading (the dashboard's Next step) is `aria-hidden` with no status of its own.
- **Same layout:** a page skeleton reuses the real list and card classes (`.medication`, `.appointment`, `.medical-documents__list li`, `.provider-card`, `.card-grid`, `.vitals-charts`, `.progress-summary__item`) and puts `<Bone />` shapes inside. A new list page adds its own skeleton the same way.
- **Header actions:** a page that shows its primary action or More only after loading passes `loadingActions={2}` (or 1) to `PageTitle` while it loads. Button-shaped placeholders (`aria-hidden`) then hold the row, so the list doesn't move down when the buttons appear (My medications, My appointments).
- **Motion:** a slow shimmer, and no animation with `prefers-reduced-motion`. Skeletons never print.
- **Kept in check:** `__tests__/loadingPlaceholders.test.js` fails if a page brings back the heartbeat loader (or `Heartbeat.js`) or uses the Held loader outside the Symptom check.
- The Selenium accessibility audit waits until no `.loader` and no `[aria-busy="true"]` region is on screen before it scans.

### Wellbeing exercises

The **Wellbeing** page (`pages/wellbeing.js`, title and h1 "Wellbeing", the last link in **My care**) and `components/wellbeing/`, with their timing and wording in `lib/wellbeingExercises.js`. Also opened from the dashboard Wellbeing Corner's **Two minutes to breathe** row (`/wellbeing?start=breathing`; `grounding`, `reset` and `wind-down` work too). On it, My care shows as the current section. **Never on a symptom-check result**: the self-harm result's "View mental health support" still goes to the Wellbeing Corner, where the support numbers come before the breathing row.

| Exercise | What it does |
| --- | --- |
| Breathing exercise | The [breathing dot](#the-breathing-dot) grows (Breathe in, 4 s), stays large (Hold, 4 s) and shrinks (Breathe out, 6 s); 9 rounds, 126 s. One Start / Pause / Resume button (focus stays on it) and Stop. With reduce motion there is no dot: the same steps as text with their countdown. The step line is a polite live region that only changes between steps, so a screen reader hears each step once; the countdown is `aria-hidden`. |
| Grounding exercise | "5, 4, 3, 2, 1", one step at a time with Back and Next (focus moves to the new step). No text input. |
| 5-minute reset | Breathing, then grounding, then the question of the day, with a progress list (`aria-current="step"`) and "Stop the reset" at every step. |
| Bedtime wind-down | A four-item evening checklist (also on Water and sleep). The ticks stay on screen only. Ends with "Log your sleep tomorrow morning", linking to the sleep log. |
| Question of the day | One of 30 fixed questions, by the Beirut date (it changes at midnight in Beirut; "Today's message" uses the same day). Shown only: no text box, nothing saved. On /wellbeing only (said once). |

- **Nothing is stored:** no mood, answers, ticks or history, not even in the browser. No AI.
- **Support with every exercise** (`WellbeingHelp`): "If you're in danger, call 140 now. To talk to someone, call the National Lifeline 1564, available 24/7.", the two existing call buttons (`WellbeingSupportNumber`), "When to reach out" (you feel unsafe, you can't cope with daily life, you have thoughts of hurting yourself) and Embrace's official website ([wellbeing-support-verification.md](./wellbeing-support-verification.md)). It sits inside the exercise panel, from start to end; with no exercise open it is a card at the bottom of the page, so 140 still appears once per page.
- **Words:** calm and plain. Say an exercise "can help you slow down"; never say it treats, cures or prevents anything.
- **Layout:** neutral surfaces. Breathing is the large lead card (the breathing dot, its timing and one **Start**); grounding, the reset and the wind-down are smaller cards with ONE text link each, **Start** (its hidden end names the exercise: "Start the grounding exercise"). The question of the day and the helplines follow in one stone card, in the same compact style as the dashboard's Wellbeing Corner. The running exercise opens in an `InlinePanel` under the header (Escape and Close return focus to its Start). Every control is at least 44px.

### EmptyState

The one empty state for every list or area with nothing in it yet: **a drawing, one line, one button.** Write the line as one sentence that says what's missing and what to do next ("No appointments yet: add your next doctor's visit so Nabad can remind you."). The button is the next step, as a secondary button. Leave it out when the page's header row already has that action (Log reading, Add documents, Add appointment, Add medication: the line alone is enough) and when there is nothing to do (no notifications yet). Keep it when the next step is somewhere the header doesn't offer (Clear filters, Add an allergy in its My health card, Open My medications on the overview).

```jsx
<EmptyState illustration={<MedicineBox size="4rem" />}
            title="No medications yet: add the ones you take so they're ready for your doctor."
            action={<Button variant="secondary" onClick={openForm}>Add medication</Button>} />
<EmptyState title="No notifications yet: appointment reminders and other alerts will appear here." />   // the clipboard by default
```

Drawings are 4rem. The default is the clipboard; use the medicine box for medications, the two hearts for people you care for and water and sleep, the person with a phone or the Nabad assistant on the symptom check. On phones (under 30rem) the drawing, line and button stack.

### Dialog

```jsx
<Dialog title="Remove emergency contact?">
  <p>...</p>
  <div className="button-row">
    <Button variant="danger">Yes, remove</Button>
    <Button variant="secondary">Keep contact</Button>
  </div>
</Dialog>
```

### Smaller helpers (classes)

| Class | Use |
| --- | --- |
| `.lead` | Larger muted intro paragraph |
| `.text-muted`, `.text-sm` | Secondary text |
| `.prose` | Limit a paragraph to a comfortable line length |
| `.section` | 48px space above a page section |
| `.stack` | Vertical list of blocks with even gaps |
| `.button-row` | Buttons side by side, wrapping on phones |
| `.details` + `.details__label` | Label above value (profile details) |
| `.plain-list` | Rows separated by thin lines (linked profiles) |
| `.symptom-card` | The dashboard's deep spruce symptom card: the one main thing to do on Today |
| `.visually-hidden` | Text for screen readers only |

---

## Illustrations

Five original line drawings in one style: spruce outlines, round line ends, no fills or gradients, slightly uneven lines so they feel hand-drawn. `TwoHearts` adds a second line color with the class `illustration__strong` (the darker heading spruce). They are decorative (hidden from screen readers) unless you pass a `title`.

| Component | Shows | Used on |
| --- | --- | --- |
| `PersonWithPhone` | A person holding a phone with a pulse on screen | Landing (symptom check card), onboarding step 1, symptoms page with no profile |
| `MedicineBox` | A first-aid box with a cross | Landing (emergency hospital card) |
| `SmallHouse` | A small house with a door, window and plant | Landing (hospitals and clinics), onboarding step 3 |
| `TwoHearts` | A large heart with a half-size heart tucked in front of its lower right side (the small one in the darker spruce) | Caregiver spots: landing (family care), onboarding step 2, "No linked profiles yet", care circle and water and sleep empty states |
| `Clipboard` | A clipboard with a few lines | The default `EmptyState` drawing (vitals, documents, appointments, notifications, My health) |

```jsx
import { MedicineBox } from "../components/illustrations";
<MedicineBox size="5rem" />                         // decorative
<MedicineBox size="5rem" title="A first-aid box" /> // meaningful image (rare)
```

### The landing page sample result

The landing hero shows a **sample symptom-check result** instead of a drawing, so visitors see what Nabad gives back. It is ONE white card in the result's accent style (the quoted symptom, the level chip with how soon, the action in ink, the four-segment `UrgencyScale` bar with only the current segment coloured, then "Then: family medicine providers near you" under a thin divider; no nested card), uses the triage API's own wording for "See a doctor soon" (label, timeframe and action), and is always:

- labelled as a sample (a "Sample" badge and the caption "An example result, with made-up symptoms"),
- made-up, generic symptoms, never a real person's data,
- a calm level (never urgent or emergency), and
- not interactive: no links or buttons inside it.

Keep the illustrations themselves small (4 to 7rem) and friendly. Use them on the landing page, in onboarding and in empty states, not as decoration on every page. Drawn larger (like the landing hero), pass a thinner `strokeWidth` so the line looks as fine as at the small sizes, and a `viewBox` that crops to the drawing.

To add a new one, follow the same rules: 120x120 viewBox, `stroke="currentColor"`, stroke width 2.5, round caps and joins, no fills. Where one line passes behind another, end it with its round cap a little before the crossing rather than crossing or cutting it.

---

## Writing

Write like a kind nurse would talk: short, plain, calm, no hype.

- "Tell us how you feel" rather than "Input your symptoms".
- Say what happened and what to do next: "Could not save your profile. Please try again."
- No exclamation-mark excitement, no "AI-powered", no "smart".
- Sentence case for new headings and buttons ("Save changes", not "Save Changes").
- Dates and times always go through `frontend/lib/dates.js`: `formatDate()` gives "11 November 2026" and `formatDateTime()` gives "11 November 2026, 01:44". Both use Beirut time whatever the device is set to. No seconds, no "11/11/2026", and no ISO dates like "2026-10-29" on screen. Never cut the day out of a timestamp with `.slice(0, 10)`: that is the UTC day, which is the day before between midnight and 02:00 (03:00 in summer) in Beirut.
