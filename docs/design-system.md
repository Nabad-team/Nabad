# Nabad design system: "warm clinic"

Nabad should feel like a good clinic: calm, warm and human. Not an AI product, not a tech template.

**Do:** warm paper background, left-aligned text, generous white space, one clear action per screen, plain kind words.
**Don't:** gradients, glow, glassy cards, sparkle icons, emoji as icons, 3D blobs, centering everything, a shadow or a box around every block.

Everything lives in three stylesheets (imported once in `frontend/pages/_app.js`) and a few components:

| File | What's in it |
| --- | --- |
| `frontend/styles/tokens.css` | Colors, font, type scale, spacing, radius, shadows (CSS variables) |
| `frontend/styles/base.css` | Defaults for `body`, headings, links, form controls, focus ring |
| `frontend/styles/components.css` | Classes used by the components below |
| `frontend/components/ui/` | `Button`, `Input`, `Card`, `Alert`, `EmptyState`, `PageLayout`, `PageTitle`, `Heartbeat` |
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
| `--color-bg` | `#faf6ef` | Page background (warm paper, never pure white) |
| `--color-surface` | `#fffdf9` | Inputs, cards, dialogs: slightly lighter than the page |
| `--color-sunken` | `#f3ede3` | Quiet areas |
| `--color-text` | `#2a2622` | Body text (13.9:1) |
| `--color-text-muted` | `#5c554d` | Hints, secondary text (6.8:1) |
| `--color-border` | `#e6ded2` | Dividers, card edges (decorative only) |
| `--color-border-strong` | `#8b8176` | Input outlines (3.8:1, meets 3:1 for controls) |
| `--color-primary` | `#0f766e` | Logo teal: primary buttons, links, icons (5.1:1; white on it 5.5:1) |
| `--color-primary-strong` | `#134e4a` | Headings and teal text (8.8:1) |
| `--color-primary-soft` | `#f0fdfa` | Light teal panels, info banners |
| `--color-accent` | `#9c4a2f` | Muted terracotta. **Sparingly**: one highlight per screen at most (e.g. the "Nabad is not a doctor" note) |
| `--color-danger` | `#b42318` | **Only** emergencies, errors and delete buttons. Red must always mean something. |
| `--color-success` | `#146c43` | Saved, done |
| `--color-warning` / `-strong` | `#c98a1b` / `#7a4a08` | Needs attention soon (border / text) |
| `--color-urgent` | `#c2410c` | Symptom urgency level "urgent" only |

Colors have `-strong` (text on the soft background) and `-soft` (background) variants where needed. Grays are warm (brown-leaning), never blue-gray.

## Typography

**IBM Plex Sans**, loaded with `next/font` in `_app.js` (self-hosted, so the browser sends no request to Google). You don't need to set a font anywhere: `body` has it.

| Token | Size | Use |
| --- | --- | --- |
| `--text-3xl` | 36 to 48px (fluid) | Landing headline only |
| `--text-2xl` | 32px | `h1` |
| `--text-xl` | 24px | `h2` |
| `--text-lg` | 20px | `h3`, lead paragraphs |
| `--text-base` | 17px | Body text |
| `--text-sm` | 15px | Hints, footnotes |

Line height is 1.65 for text and 1.25 for headings. Headings are semibold (600), in `--color-primary-strong`.

**Use `rem`, never `px`.** The text-size setting (#20) will change the root font size, and everything in rem grows with it. `1rem` = 16px by default.

## Spacing, shape, shadow

- Spacing: `--space-1` (4px) `-2` (8) `-3` (12) `-4` (16) `-5` (24) `-6` (32) `-7` (48) `-8` (64) `-9` (96).
- Radius: `--radius-sm` (6px), `--radius-md` (8px, buttons and inputs), `--radius-lg` (12px, cards and dialogs). Modest, not bubbly.
- Shadows: `--shadow-sm` exists but is rarely needed; `--shadow-overlay` is for dialogs only. Separate things with space and a thin border, not shadows.
- Widths: content column `--width-content` (46rem), forms `--width-form` (28rem), paragraphs `--width-prose` (38rem), landing `--width-wide` (68rem).
- Side margins: `--page-gutter` is 16px on phones and 32px from 640px up. `PageLayout` applies it, so content never touches the screen edge.

## Accessibility built in

- Every button and input is at least **44px** tall (`--tap-target`).
- **Keyboard focus** shows a 3px teal outline on everything (`:focus-visible` in `base.css`). Don't remove it.
- Every page has a "Skip to main content" link (it appears when you press Tab).
- Colors meet AA; color is never the only signal (errors and urgency levels are always written out).
- Animations stop when the user turns on "reduce motion".

---

## The signature: the heartbeat line

The pulse from the logo, used in **two places only**. Don't add it elsewhere, and don't change the logo.

1. **Under page titles**: `PageTitle` draws it for you.
   ```jsx
   <PageTitle lead="Optional short sentence under the title.">Your medicines</PageTitle>
   ```
2. **As the loading indicator**: a pulse travels along the line. It has `role="status"`, so screen readers announce the label.
   ```jsx
   import { HeartbeatLoader } from "../components/ui/Heartbeat";
   {loading && <HeartbeatLoader label="Loading your medicines..." />}
   ```

---

## Components

### PageLayout

The frame of every page: header, then content in a centered column with proper side margins. Text inside stays left-aligned.

```jsx
<PageLayout header={<ProfileHeader />}>...</PageLayout>   // signed-in pages with the profile switcher
<PageLayout>...</PageLayout>                              // logo-only header (sign-in pages, onboarding)
<PageLayout width="wide" header={<SiteHeader width="wide">links</SiteHeader>} footer={<p>...</p>}>  // landing
```

Don't render your own `<main>`; `PageLayout` does (with `id="main"` for the skip link). It also adds the favicon.

Note: `ProfileHeader` needs the `ActiveProfileProvider` from `_app.js`. If your page's tests render it without the provider, use the plain `<PageLayout>` header.

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
| `PersonWithPhone` | A person holding a phone with a pulse on screen | Landing hero (large: `size="100%" strokeWidth={0.7} viewBox="14 17 88 92"`), landing (symptom check), onboarding step 1, symptoms page with no profile |
| `MedicineBox` | A first-aid box with a cross | Landing (emergency hospital) |
| `SmallHouse` | A small house with a door, window and plant | Landing (hospitals and clinics), onboarding step 3 |
| `TwoHearts` | A large heart with a half-size heart tucked in front of its lower right side (the small one in the darker teal) | Caregiver spots: landing (family care), onboarding step 2, "No linked profiles yet" |

```jsx
import { MedicineBox } from "../components/illustrations";
<MedicineBox size="5rem" />                         // decorative
<MedicineBox size="5rem" title="A first-aid box" /> // meaningful image (rare)
```

Keep them small (4 to 7rem) and friendly. Use them on the landing page, in onboarding and in empty states, not as decoration on every page. Drawn larger (like the landing hero), pass a thinner `strokeWidth` so the line looks as fine as at the small sizes, and a `viewBox` that crops to the drawing.

To add a new one, follow the same rules: 120x120 viewBox, `stroke="currentColor"`, stroke width 2.5, round caps and joins, no fills. Where one line passes behind another, end it with its round cap a little before the crossing rather than crossing or cutting it.

---

## Writing

Write like a kind nurse would talk: short, plain, calm, no hype.

- "Tell us how you feel" rather than "Input your symptoms".
- Say what happened and what to do next: "Could not save your profile. Please try again."
- No exclamation-mark excitement, no "AI-powered", no "smart".
- Sentence case for new headings and buttons ("Save changes", not "Save Changes").
