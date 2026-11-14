# Nabad design system: "warm clinic"

Nabad should feel like a good clinic: calm, warm and human. Not an AI product, not a tech template.

**Do:** a soft neutral canvas, white surfaces, left-aligned text, generous space, clear actions and plain kind words. Keep teal as the main identity color.
**Don't:** gradients, glow, glassy cards, sparkle icons, emoji as icons, 3D blobs, centering everything, a shadow or a box around every block.

Everything lives in three stylesheets (imported once in `frontend/pages/_app.js`) and a few components:

| File | What's in it |
| --- | --- |
| `frontend/styles/tokens.css` | Colors, font, type scale, spacing, radius, shadows (CSS variables) |
| `frontend/styles/base.css` | Defaults for `body`, headings, links, form controls, focus ring |
| `frontend/styles/components.css` | Classes used by the components below |
| `frontend/components/ui/` | `Button`, `Input`, `Card`, `Alert`, `Badge`, `EmptyState`, `PageLayout`, `PageTitle`, `Heartbeat` |
| `frontend/components/illustrations.js` | The four line drawings |

**Rule of thumb:** a new page should need no `style={{...}}` and no hex colors. If you need a color or a size, use a token (`var(--color-primary)`, `var(--space-4)`). If you need something new, add it to the system rather than to your page.

---

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

All text pairs below meet WCAG AA (4.5:1) on the page background, checked with the WCAG contrast formula.

| Token | Value | Use it for |
| --- | --- | --- |
| `--color-bg` | `#f7f8f5` | Soft neutral page canvas |
| `--color-surface` | `#ffffff` | Inputs, cards and dialogs |
| `--color-sunken` | `#eef2ef` | Quiet inset areas |
| `--color-text` | `#243631` | Body text (12.0:1 against the canvas) |
| `--color-text-muted` | `#596962` | Hints and secondary text (5.4:1) |
| `--color-border` | `#dce5df` | Dividers and card edges (decorative only) |
| `--color-border-strong` | `#7d8d84` | Control outlines (3.3:1 against the canvas) |
| `--color-primary` | `#0f766e` | Logo teal: primary buttons, links, icons (5.1:1; white on it 5.5:1) |
| `--color-primary-strong` | `#134e4a` | Headings and teal text (8.8:1) |
| `--color-primary-soft` | `#eaf5f1` | Light teal panels and info banners |
| `--color-accent` | `#9c4a2f` | Muted terracotta. **Sparingly**: one highlight per screen at most (e.g. the "Nabad is not a doctor" note) |
| `--color-danger` | `#b42318` | **Only** emergencies, errors and delete buttons. Red must always mean something. |
| `--color-success` | `#146c43` | Saved, done |
| `--color-warning` / `-strong` | `#c98a1b` / `#7a4a08` | Needs attention soon (border / text) |
| `--color-urgent` | `#c2410c` | Symptom urgency level "urgent" only |

Colors have `-strong` (text on the soft background) and `-soft` (background) variants where needed. High contrast mode overrides the shared palette.

## Typography

**IBM Plex Sans**, loaded with `next/font` in `_app.js` (self-hosted, so the browser sends no request to Google). You don't need to set a font anywhere: `body` has it.

| Token | Size | Use |
| --- | --- | --- |
| `--text-3xl` | 36 to 48px (fluid) | Landing headline only |
| `--text-2xl` | 28 to 36px (fluid) | `h1` |
| `--text-xl` | 24px | `h2` |
| `--text-lg` | 20px | `h3`, lead paragraphs |
| `--text-base` | 16px | Body text |
| `--text-sm` | 15px | Hints, footnotes |

Line height is 1.6 for text and 1.25 for headings. Headings are semibold (600), in `--color-primary-strong`.

**Use `rem`, never `px`.** The text-size setting (#20) will change the root font size, and everything in rem grows with it. `1rem` = 16px by default.

## Spacing, shape, shadow

- Spacing: `--space-1` (4px) `-2` (8) `-3` (12) `-4` (16) `-5` (24) `-6` (32) `-7` (48) `-8` (64) `-9` (96).
- Radius: `--radius-sm` (8px), `--radius-md` (12px, buttons and inputs), `--radius-lg` (18px, cards and dialogs).
- Shadows: `--shadow-sm` gives grouped surfaces a light lift; `--shadow-overlay` is for menus and dialogs. Pair these with a thin border.
- Widths: workspace `--width-content` (62rem), forms `--width-form` (28rem), paragraphs `--width-prose` (38rem), header and landing `--width-wide` (74rem). Legal pages use a 46rem reading column.
- Side margins: `--page-gutter` is 16px on phones and 32px from 640px up. `PageLayout` applies it, so content never touches the screen edge.

## Accessibility built in

- Every button and input is at least **44px** tall (`--tap-target`).
- **Keyboard focus** shows a 3px teal outline on everything (`:focus-visible` in `base.css`). Don't remove it.
- Every page has a "Skip to main content" link (it appears when you press Tab).
- Colors meet AA; color is never the only signal (errors and urgency levels are always written out).
- Animations stop when the user turns on "reduce motion".

Workspace pages use a wider column while forms keep their 28rem maximum. Progress cards use two columns on larger screens and one on phones; water and sleep sit side by side from 56rem. Document rows and their metadata editors wrap into compact grids. Avoid fixed flex bases when changing a row into a column: the basis becomes a height and can create large empty gaps. Preserve visible labels, consent text, keyboard focus, and the existing print-specific layouts when refining a screen.

---

## The signature: the heartbeat line

The pulse from the logo, used in **two places only**, plus the Nabad assistant drawn from it (below). Don't add it elsewhere, and don't change the logo.

1. **Under page titles**: `PageTitle` draws it for you.
   ```jsx
   <PageTitle lead="Optional short sentence under the title.">Your medicines</PageTitle>
   ```
2. **As the loading indicator**: a pulse travels along the line. It has `role="status"`, so screen readers announce the label.
   ```jsx
   import { HeartbeatLoader } from "../components/ui/Heartbeat";
   {loading && <HeartbeatLoader label="Loading your medicines..." />}
   ```

### The Nabad assistant

A small friendly face drawn from the pulse line: the big beat of the heartbeat becomes a rounded head peeking up ("Pulse peek"). It is not a person, a doctor or a nurse. `components/NabadAssistant.js`:

```jsx
import NabadAssistant, { AssistantLoader } from "../components/NabadAssistant";
<NabadAssistant size="4.5rem" title="Nabad assistant" />            // full drawing, 4rem and up
<NabadAssistant size="3rem" crop="head" title="Nabad assistant" />  // cropped to the head, bigger eyes: 2 to 3rem
<AssistantLoader label="Checking your symptoms" />                  // the line draws itself; still with reduced motion
```

- **Only in calm places:** onboarding (step 1), empty states (the symptom-check history), the health assistant greeting, and the symptom-check loader.
- **Never** on urgent or emergency results, next to the emergency dialog, on the emergency card (or its offline copy), or on any "Call 140" screen or bar. The symptom check hides it as soon as a result is urgent or an emergency.
- Name it "Nabad assistant" (`title`) where it carries meaning. In the loader it is decorative, so only the label is announced.
- Next to the assistant, keep the existing wording "Nabad gives guidance, not a diagnosis."
- Line in `--color-primary`, eyes and smile in `--color-primary-strong`, round ends, no fills. Below about 3rem use `crop="head"` so the face stays readable.

---

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

Every signed-in page uses `<ProfileHeader />`. It draws the header bar (`components/AppHeader.js`), then the picture controls (unless `showPicture={false}`) and, when acting for a family member, the "Acting as" banner.

```
Desktop   [Nabad]  [Search]                                                 [Bell] [Profile ▾] [(RH)▾]
          Symptom check  Dashboard  My care ▾  My records ▾  Health assistant  Find care
                                                                                      My profile
                                                                                      Account security
                                                                                      Sign out
Phone     [Nabad]                                                              [Bell] [Menu]
          ┌ Symptom check · Dashboard · ... · Acting for [▾] · My profile · Account security · Sign out ┐
```

- **Workspace navigation** (`NAV_ITEMS` in `AppHeader.js`) is **one row** below the desktop account bar: Symptom check (always first), Dashboard, the **My care** dropdown (My appointments, My medications, Medication overview, Water and sleep), the **My records** dropdown (My health, My vitals, My documents, Visit preparation), Health assistant and Find care. The phone menu shows the same items in the same order, with My care and My records as labelled groups. A new page goes into one of the groups rather than adding a seventh item to the row.
- **Dropdowns** are disclosure buttons (`aria-expanded`, `aria-controls`), not ARIA menus: links stay links. Enter or Space opens one and focuses its first link; Down/Up move between links (on the closed button they open it at the first/last link), Home/End jump, Escape closes it and returns focus to the button; a click outside or tabbing out closes it. When one of its pages is open, the group button gets the current-page style and the name "My care, current section", and the link inside has `aria-current="page"`.
- **One name per page.** A link's label is exactly the page's `<title>` and `<h1>` (for example "My medications", "Symptom check"), also in simplified mode. Personal records use "My …" (My health, My vitals, My medications, My appointments, My documents, My profile); tools keep plain names (Symptom check, Visit preparation, Health assistant, Find care, Water and sleep). For a linked profile the title names them instead ("Vitals for Rania"). The dashboard doesn't repeat the menu as tiles; its quick actions are equal icon tiles with one-line labels.
- **Right side:** the profile switcher, then the **account menu**: a round button with the user's initials that opens My profile, Security and Sign out (`ACCOUNT_LINKS`). New controls such as a notifications bell go on the right, before the account menu. At 1280px there is plenty of room.
- **Phones (under 40rem / 640px):** the logo and a **Menu** button. The menu is a full-width panel under the bar, in the page flow (not an overlay), with every link, the profile switcher ("Acting for") and Sign out.
- **From 40rem** the workspace row sits under the logo and account bar. It is one line on laptops and wide tablets; on narrow tablets or with very large text it wraps rather than scrolling.
- **Current page:** its link gets `aria-current="page"`, shown as light teal with a teal underline (never color alone). On My profile or Security, the account button gets a teal ring.
- **Keyboard:** the account menu and the phone menu are disclosure buttons too (`aria-expanded`, `aria-controls`):
  - Opening a menu moves focus to its first item.
  - Tab moves through the items. Tabbing out, clicking outside, or pressing Escape closes the menu.
  - Escape also puts focus back on the button.
  - Use links for pages and a button for actions (Sign out). Don't turn these into ARIA `menu`s: they are lists of links. (Arrow keys in the workspace dropdowns are an extra, not the ARIA menu pattern.)

### Button

```jsx
<Button>Save</Button>                                   // primary: the main action. Usually one per screen.
<Button variant="secondary">Cancel</Button>             // everything else: Cancel, Back, Edit, Skip
<Button variant="danger">Delete my account</Button>     // only for deleting data
<Button href="/profile" variant="secondary">My profile</Button>   // a link that looks like a button
<Button size="small">Sign out</Button>                  // smaller text, still 44px tall
<Button block type="submit">Log in</Button>             // full width (single-column forms)
```

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
<Alert tone="warning" title="Please verify your email.">...</Alert>
<Alert tone="info">...</Alert>
<Alert tone="note" title="Nabad is not a doctor.">...</Alert>   // terracotta accent, rare
```

Use `role="alert"` for errors that need attention now and `role="status"` for calm confirmations. Leave `role` off for static text.

### Symptom check result

While a check runs, the submit button reads "Checking..." and is disabled, and `AssistantLoader` (the Nabad assistant tracing its pulse line) shows "Checking your symptoms". When the result arrives (or follow-up answers update it), the page moves focus to the result card, scrolls to it (instantly with reduced motion) and announces one short line in a live region that is always on the page. Emergencies are the exception: the emergency dialog takes focus and the card keeps `role="alert"`.

The card starts with the level's icon, "Urgency: <label>" and one short line, then a 4-step scale (Routine / self-care, See a doctor soon, Urgent, Emergency) using the triage API's own labels. The current step has its colour, its icon, bold text, "This result" and `aria-current="step"`. The scale only displays the server's level; it never decides one.

### Badge

A small calm label next to a heading. Never red: teal informs, gray marks what is no longer current, amber asks for a second look.

```jsx
<figcaption><Badge tone="neutral">Sample</Badge> An example result</figcaption>
<Badge tone="neutral">Discontinued</Badge>   // gray, for things no longer current
<Badge tone="warning">Missing dose</Badge>   // amber, something worth checking (still not red)
```

### Card

A quiet box for grouping related things (e.g. the emergency contact). **Use it only when grouping helps.** Most content sits directly on the page, separated by headings and space.

```jsx
<Card aria-labelledby="contact-heading"><h2 id="contact-heading">Emergency contact</h2>...</Card>
<Card tone="danger">...</Card>   // destructive settings ("Danger zone")
```

### EmptyState

For a list or area with nothing in it yet: a small drawing, one sentence, and the next step if there is one.

```jsx
<EmptyState illustration={<MedicineBox size="5rem" />} title="No medicines yet."
            action={<Button variant="secondary">Add a medicine</Button>}>
  Add the medicines you take, so they are ready when you need them.
</EmptyState>
```

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
| `.check-in` | The one light-teal panel for the main thing to do on a page (dashboard) |
| `.visually-hidden` | Text for screen readers only |

---

## Illustrations

Four original line drawings in one style: teal outlines, round line ends, no fills or gradients, slightly uneven lines so they feel hand-drawn. `TwoHearts` adds a second line color with the class `illustration__strong` (the darker heading teal). They are decorative (hidden from screen readers) unless you pass a `title`.

| Component | Shows | Used on |
| --- | --- | --- |
| `PersonWithPhone` | A person holding a phone with a pulse on screen | Landing (symptom check card), onboarding step 1, symptoms page with no profile |
| `MedicineBox` | A first-aid box with a cross | Landing (emergency hospital card) |
| `SmallHouse` | A small house with a door, window and plant | Landing (hospitals and clinics), onboarding step 3 |
| `TwoHearts` | A large heart with a half-size heart tucked in front of its lower right side (the small one in the darker teal) | Caregiver spots: landing (family care), onboarding step 2, "No linked profiles yet" |

```jsx
import { MedicineBox } from "../components/illustrations";
<MedicineBox size="5rem" />                         // decorative
<MedicineBox size="5rem" title="A first-aid box" /> // meaningful image (rare)
```

### The landing page sample result

The landing hero shows a **sample symptom-check result** instead of a drawing, so visitors see what Nabad gives back. It is built in HTML from the real result styles (`.urgency`, `.urgency__indicator`, `.urgency-scale__*`), uses the triage API's own wording for "See a doctor soon", and is always:

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
