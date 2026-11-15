# Nabad design system: "warm clinic"

Nabad should feel like a good clinic: calm, warm and human. Not an AI product, not a tech template.

**Do:** a soft neutral canvas, white surfaces, left-aligned text, generous space, clear actions and plain kind words. Keep teal as the main identity color.
**Don't:** gradients, glow, glassy cards, sparkle icons, emoji as icons, 3D blobs, centering everything, boxes nested inside boxes.

Everything lives in three stylesheets (imported once in `frontend/pages/_app.js`) and a few components:

| File | What's in it |
| --- | --- |
| `frontend/styles/tokens.css` | Colors, font, type scale, spacing, radius, shadows (CSS variables) |
| `frontend/styles/base.css` | Defaults for `body`, headings, links, form controls, focus ring |
| `frontend/styles/components.css` | Classes used by the components below |
| `frontend/components/ui/` | `Button`, `Input`, `Card`, `Alert`, `Badge`, `EmptyState`, `PageLayout`, `PageTitle`, `MoreMenu`, `InlinePanel`, `Heartbeat` |
| `frontend/components/illustrations.js` | The five line drawings |

**Rule of thumb:** a new page should need no `style={{...}}` and no hex colors. If you need a color or a size, use a token (`var(--color-primary)`, `var(--space-4)`). If you need something new, add it to the system rather than to your page.

---

## Signed-in page template

Every signed-in page follows the same frame, so the app reads as one product:

```
┌ header (74rem) ─────────────────────────────────────────────────────────────┐
│ My vitals                                              [Log reading] [More ▾] │  ← PageTitle: title + one-line lead left,
│ ~~~~~                                                                         │    one primary action and More right
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
   The panel is a labelled card (a region named by its h2) with a teal edge. Opening it moves focus to its first field; Escape and Cancel close it, and focus goes back to the button that opened it (also after saving). The opening button has `aria-expanded` and `aria-controls`.
   - **My vitals:** History and trends first; **Log reading** opens the form. More: Review vitals before a visit.
   - **My documents:** the list first (the card has its heading only; the page's lead already describes it, including "Any file type up to 10 MB each"); **Add documents** opens the file picker, and the panel then asks for the type and date of the chosen files ("Details for 2 files", "Upload 2 files"). Files are checked (count, empty, 10 MB) before the panel opens. More: Attach documents to visit preparation.
5. **Empty states** use the one `EmptyState` component.

A short form keeps its 28rem width inside its card. On a page of short sections, the card grid puts two cards side by side from 64rem, so the wide column never looks half empty.

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
- Widths: header, every signed-in page and the landing page `--width-wide` (74rem); sign-in and info pages `--width-content` (62rem); forms `--width-form` (28rem); paragraphs `--width-prose` (38rem). Legal pages use a 46rem reading column.
- Side margins: `--page-gutter` is 16px on phones and 32px from 640px up. `PageLayout` applies it, so content never touches the screen edge.

## Accessibility built in

- Every button and input is at least **44px** tall (`--tap-target`).
- **Keyboard focus** shows a 3px teal outline on everything (`:focus-visible` in `base.css`). Don't remove it.
- Every page has a "Skip to main content" link (it appears when you press Tab).
- Colors meet AA; color is never the only signal (errors and urgency levels are always written out).
- Animations stop when the user turns on "reduce motion".

Signed-in pages use the header's 74rem column while forms keep their 28rem maximum (see [Signed-in page template](#signed-in-page-template)). Progress cards use two columns on larger screens and one on phones; water and sleep sit side by side from 56rem. Document rows and their metadata editors wrap into compact grids. Avoid fixed flex bases when changing a row into a column: the basis becomes a height and can create large empty gaps. Preserve visible labels, consent text, keyboard focus, and the existing print-specific layouts when refining a screen.

---

## The signature: the heartbeat line

The pulse from the logo, used **under page titles only**, plus the Nabad assistant drawn from it (below). Don't add it elsewhere, and don't change the logo. `PageTitle` draws it for you:

```jsx
<PageTitle lead="Optional short sentence under the title.">Your medicines</PageTitle>
```

It is no longer a loader: the old `HeartbeatLoader` is gone (see [Loading placeholders](#loading-placeholders-skeletons)). The only animated loading indicator is the Symptom check's `AssistantLoader`, while it is checking.

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
- **Say it once.** A page doesn't repeat what the header or another page already offers. The dashboard keeps the Next step card (when something applies), the symptom check, Your progress (with the upcoming appointment), at most four quick actions and a compact Wellbeing Corner (today's message and the question of the day, the two support numbers, then the four calm exercise buttons; tips and notes under "More"). Apart from the footer line, 140 appears once per page.
- **Badges state known facts only.** Find care cards show distance, driving time, open/closed per published hours and the 24/7 ER status only when known; nothing says "not verified" on the card. One note above the list explains this, and "Information may be outdated" sits under More details. "Estimate driving times" and "Show map" sit side by side from 40rem (`.provider-tools`) and stack on phones.
- **Right side:** the profile switcher, then the **account menu**: a round button with the user's initials that opens My profile, Security and Sign out (`ACCOUNT_LINKS`). New controls such as a notifications bell go on the right, before the account menu. At 1280px there is plenty of room.
- **Phones (under 40rem / 640px):** the top bar has the logo, search and the bell; navigation moves to the **bottom tab bar** (below).
- **Bottom tab bar** (`components/BottomTabBar.js`, phones only): fixed to the bottom, four equal tabs: **Symptom check, Dashboard, Find care, Menu** (`TAB_LINKS` in `AppHeader.js`). Rules:
  - Every tab has an icon above a text label (never icon only) and is at least 44px tall (`--tab-bar-height`, 3.75rem).
  - It is its own landmark, `<nav aria-label="Quick links">`, after the header. The current page's tab gets `aria-current="page"` (teal text, light teal fill and a teal bar on top). On any page that lives in the menu, Menu gets the current style and the name "Menu, current section".
  - **Menu** is the phone menu's disclosure button: it opens a sheet just above the bar (scrolls on its own, at most the screen minus 4rem) with every link (My care and My records as labelled groups), "Acting for", the account links and Sign out. Keyboard and close behavior are the same as the other menus.
  - **Never cover content:** pages get bottom padding equal to the bar's measured height (`--tab-bar-space`, set by the bar; the fallback is `--tab-bar-height` plus the safe area), so the footer and its 140 link stay visible. Anything sticky at the bottom (`.action-toast`) sits above the bar. A new bottom-fixed element must do the same.
  - **Hidden** from 40rem (tablets and desktop keep the header row) and on paper (`@media print`: emergency card, medication overview, doctor summary, report printouts). The offline emergency page (`public/offline.html`) is static and never has it.
  - Don't add a fifth tab: a new page goes in the menu.
- **iPhone safe areas:** the viewport uses `viewport-fit=cover` (`pages/_app.js`), so every full-width element pads by `env(safe-area-inset-*)`: `.container` (header, page content, footer) uses `max(var(--page-gutter), env(safe-area-inset-left/right))`, and the tab bar, staging banner and offline banner pad by the insets too. A new full-width element that is not inside `.container` needs the same padding, or its text can go under the notch in landscape.
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

While a check runs, the submit button reads "Checking..." and is disabled, and `AssistantLoader` (the Nabad assistant tracing its pulse line) shows "Checking your symptoms". When the result arrives (or follow-up answers update it), the page moves focus to the result card, scrolls to it (instantly with reduced motion) and announces one short line in a live region that is always on the page. Emergencies are the exception: the emergency dialog takes focus and the card keeps `role="alert"`.

The card starts with the level's icon, "Urgency: <label>" and one short line, then a 4-step scale (Routine / self-care, See a doctor soon, Urgent, Emergency) using the triage API's own labels. The current step has its colour, its icon, bold text, "This result" and `aria-current="step"`. The scale only displays the server's level; it never decides one.

### Next step (dashboard)

`components/NextStepCard.js`, with the choice made in `lib/nextStep.js`. It's one short line and one button for the active profile ("Acting for"), picked from data the dashboard already loads (`components/useDashboardData.js`, shared with Your progress so nothing is fetched twice). The first rule that applies wins:

| # | When | Line | Button |
|---|------|------|--------|
| 1 | A medication dose (its `times`) is due in the next 3 hours | Take Amlodipine 5 mg at 08:00 | Open medications |
| 2 | An appointment in the next 3 days (72 hours) | Cardiology check-up on Friday: prepare your visit ("today", "tomorrow" or the weekday) | Prepare visit |
| 3 | My health basics not all 5 filled in | Add your health basics for safer guidance | Open my health |
| 4 | No sleep logged today | Log last night's sleep | Log sleep |

- Nothing applies, or the data is still loading: the card isn't shown. It waits for every source, so it never swaps one line for another.
- Every time is Beirut time (`APP_TIME_ZONE`), whatever the device's time zone. A dose after midnight belongs to tomorrow, so ticking today's check-in doesn't hide it. A once-a-day medication already checked off today is skipped. With two or more doses a day the next dose still shows, because the check-in is one tick per day.
- For a linked profile the line names them: "Sami's Amlodipine 5 mg is due at 08:00", "Cardiology check-up for Sami on Friday: prepare the visit", "Add Sami's health basics for safer guidance", "Log Sami's sleep from last night".
- Plain reminders only, never medical advice. It sits under the email bar and the page title and above Symptom check, and it is never placed above or instead of an emergency message.
- Looks like: a white card with a teal left edge, a small "Next step" label (its h2), the line in large text, and one secondary button (it must not compete with the teal Symptom check panel).

### One primary action, and "More"

When a page has several actions, show the main one as the primary button and put the rest in a **More** button: `<MoreMenu id="..." items={[{ label, onClick } | { label, href }]} />` (`components/ui/MoreMenu.js`, built on `useDisclosure`: `aria-expanded`, Escape and outside click close it, focus goes to its first item). Falsy items are skipped, and with no items it renders nothing. Visit preparation: **Share with a doctor** (opens the sharing panel and focuses its first control) and **More** with Edit visit sheet, Print or save as PDF, and Export sheet with attachments, both in the title row. Its "Recent symptom checks" card shows the 5 newest with a "Show all (N)" toggle; the hidden ones stay in the page, so the shared doctor link, the export, the PDF and paper keep every check. My medications: **Add medication**, and More with Add from a prescription and Medication overview. My appointments: **Add appointment**, and More with Get pop-up reminders on this device (only while the browser can still ask). Styles: `.more-menu`, `.more-menu__panel`.

### Badge

A small calm label next to a heading. Never red: teal informs, gray marks what is no longer current, amber asks for a second look.

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

**The rule:** every page that loads data uses these placeholders. The only animated loader is the Symptom check's (`AssistantLoader`, the assistant tracing its pulse) while a check runs. Actions in progress (uploading documents, reading a prescription, searching the history) show one plain status line (`<p className="text-muted progress-note" role="status">Uploading documents...</p>`) next to their disabled button, without animation. Dialogs about an emergency keep their plain "Loading emergency contact..." line.

| Placeholder | Used on |
| --- | --- |
| `DashboardSkeleton`, `NextStepSkeleton`, `ProgressSkeleton` | Dashboard (and the appointment row of Your progress uses `LinesSkeleton`) |
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
- **Kept in check:** `__tests__/loadingPlaceholders.test.js` fails if a page brings back the heartbeat loader or uses the assistant loader outside the Symptom check.
- The Selenium accessibility audit waits until no `.loader` and no `[aria-busy="true"]` region is on screen before it scans.

### Wellbeing exercises

The **Wellbeing** page (`pages/wellbeing.js`, title and h1 "Wellbeing", the last link in **My care**) and `components/wellbeing/`, with their timing and wording in `lib/wellbeingExercises.js`. Also opened from the Wellbeing Corner's **Calm exercises** buttons (`/wellbeing?start=breathing`, `grounding`, `reset`, `wind-down`). On it, My care shows as the current section. **Never on a symptom-check result**: the self-harm result's "View mental health support" still goes to the Wellbeing Corner, where the support numbers come before the exercises.

| Exercise | What it does |
| --- | --- |
| Breathing exercise | A circle grows (Breathe in, 4 s), stays (Hold, 4 s) and shrinks (Breathe out, 6 s); 9 rounds, 126 s. One Start / Pause / Resume button (focus stays on it) and Stop. With reduce motion there is no circle: the same steps as text with their countdown. The step line is a polite live region that only changes between steps, so a screen reader hears each step once; the countdown is `aria-hidden`. |
| Grounding exercise | "5, 4, 3, 2, 1", one step at a time with Back and Next (focus moves to the new step). No text input. |
| 5-minute reset | Breathing, then grounding, then the question of the day, with a progress list (`aria-current="step"`) and "Stop the reset" at every step. |
| Bedtime wind-down | A four-item evening checklist (also on Water and sleep). The ticks stay on screen only. Ends with "Log your sleep tomorrow morning", linking to the sleep log. |
| Question of the day | One of 30 fixed questions, by the Beirut date (it changes at midnight in Beirut; "Today's message" uses the same day). Shown only: no text box, nothing saved. Next to Today's message and on the page. |

- **Nothing is stored:** no mood, answers, ticks or history, not even in the browser. No AI.
- **Support with every exercise** (`WellbeingHelp`): "If you're in danger, call 140 now. To talk to someone, call the National Lifeline 1564, available 24/7.", the two existing call buttons (`WellbeingSupportNumber`), "When to reach out" (you feel unsafe, you can't cope with daily life, you have thoughts of hurting yourself) and Embrace's official website ([wellbeing-support-verification.md](./wellbeing-support-verification.md)). It sits inside the exercise panel, from start to end; with no exercise open it is a card at the bottom of the page, so 140 still appears once per page.
- **Words:** calm and plain. Say an exercise "can help you slow down"; never say it treats, cures or prevents anything.
- **Layout:** the page template: a card per exercise in the card grid, and the running exercise in an `InlinePanel` under the header (Escape and Close return focus to its Start button). Every control is at least 44px.

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
| `.check-in` | The one light-teal panel for the main thing to do on a page (dashboard) |
| `.visually-hidden` | Text for screen readers only |

---

## Illustrations

Five original line drawings in one style: teal outlines, round line ends, no fills or gradients, slightly uneven lines so they feel hand-drawn. `TwoHearts` adds a second line color with the class `illustration__strong` (the darker heading teal). They are decorative (hidden from screen readers) unless you pass a `title`.

| Component | Shows | Used on |
| --- | --- | --- |
| `PersonWithPhone` | A person holding a phone with a pulse on screen | Landing (symptom check card), onboarding step 1, symptoms page with no profile |
| `MedicineBox` | A first-aid box with a cross | Landing (emergency hospital card) |
| `SmallHouse` | A small house with a door, window and plant | Landing (hospitals and clinics), onboarding step 3 |
| `TwoHearts` | A large heart with a half-size heart tucked in front of its lower right side (the small one in the darker teal) | Caregiver spots: landing (family care), onboarding step 2, "No linked profiles yet", care circle and water and sleep empty states |
| `Clipboard` | A clipboard with a few lines | The default `EmptyState` drawing (vitals, documents, appointments, notifications, My health) |

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
