// Small line drawings in one style: a single teal outline, round ends, no fills or gradients.
// The lines bend a little on purpose so they feel drawn by hand. Use them on the landing page
// and in empty states, at about 4 to 7rem. They are decorative (hidden from screen readers)
// unless you pass a title.

function Drawing({ size = "6rem", title, children }) {
  return (
    <svg
      className="illustration"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {children}
    </svg>
  );
}

// Two open hands holding a small heart: caring for someone else.
export function CaregiverHands(props) {
  return (
    <Drawing {...props}>
      {/* heart */}
      <path d="M60.4 61.5c-8.6-6-14.6-11.6-14-17.6.5-5 6.8-7.4 11.4-3l2.6 2.6 2.4-2.7c4.4-4.4 11-2.2 11.6 2.8.7 6-5.2 11.8-13.6 17.8" />
      {/* left hand, palm up: thumb, fingertips, back of the hand, sleeve */}
      <path d="M14 76.6c7.4-.4 13.6-2 18.4-5.4 3.2-2.4 5.4-6.6 8-8.8 2.4-2 5.2.2 4 3.4-.8 2-1.4 3.6-.4 4.8 1.2 1.4 6.4 1.4 10.8 1.6 3.6.2 5 2.8 3.6 5.4-1.6 3-5.6 5-10.6 6.8-11.8 4.2-21.6 6.4-33.6 6.6" />
      <path d="M57.4 82.2c-4.4.2-8.4.6-12.4 1.4" />
      <path d="M13.2 73.4c-1.4 6.6-1.4 13 .2 19.6" />
      {/* right hand, mirrored with its own small wobbles */}
      <path d="M106 76.4c-7.6-.6-13.8-2.2-18.6-5.6-3.2-2.4-5.2-6.4-7.8-8.6-2.4-2-5.4.2-4.2 3.4.8 2.2 1.6 3.8.4 5-1.2 1.4-6.2 1.2-10.6 1.4-3.6.2-5 2.8-3.4 5.4 1.6 3 5.8 5 10.8 6.8 11.6 4.2 21.4 6.6 33.4 6.8" />
      <path d="M62.8 82.4c4.4.2 8.2.6 12.2 1.4" />
      <path d="M106.8 73.2c1.6 6.8 1.4 13.2-.2 19.8" />
    </Drawing>
  );
}

// A first-aid box with a cross: medicines and care supplies.
export function MedicineBox(props) {
  return (
    <Drawing {...props}>
      {/* handle */}
      <path d="M46 44.5v-7c0-2.6 1.9-4.4 4.5-4.4h19.2c2.5 0 4.4 1.9 4.4 4.5v6.8" />
      {/* box */}
      <path d="M23.5 44.6c24.6-.6 48.6-.7 73-.2 4 .1 6.6 2.7 6.7 6.6.5 13.4.5 27 0 40.6-.1 4-2.8 6.5-6.7 6.6-24.4.5-48.6.5-73 0-3.9-.1-6.4-2.7-6.5-6.6-.5-13.6-.5-27.2 0-40.6.1-3.9 2.6-6.3 6.5-6.4z" />
      {/* cross */}
      <path d="M54.4 58.6h11.2v10.2h10.2V80H65.6v10.4H54.4V80H44.2V68.8h10.2z" />
      {/* lid line */}
      <path d="M17.6 55.4c8.2.4 16.4.5 24.6.4" />
      <path d="M78 55.8c8.2.1 16.4 0 24.6-.4" />
    </Drawing>
  );
}

// A small house with a door and a window: home, or care close to home.
export function SmallHouse(props) {
  return (
    <Drawing {...props}>
      {/* roof and chimney */}
      <path d="M17 60.5C31 48.6 45.4 37 60.2 25.6c14.4 11 28.8 22.7 43 35" />
      <path d="M81.4 42.4V29.6h8.4v19.8" />
      {/* walls */}
      <path d="M27.6 52.6c-.4 15.8-.4 31.6.2 47.4" />
      <path d="M92.6 52.8c.4 15.8.3 31.6-.3 47.2" />
      {/* door */}
      <path d="M52 100V81.6c0-4.8 3.6-8.2 8.2-8.2 4.5 0 8 3.4 8 8.2V100" />
      {/* window */}
      <path d="M34.6 64.4h13.6v13.4H34.6zM41.4 64.6v13M34.8 71.1h13.2" />
      {/* ground */}
      <path d="M8 100.4c17.4-.8 34.8-.9 52.2-.4 17.6.4 34.6.3 51.8-.6" />
      {/* small plant by the door */}
      <path d="M100.8 99.6c-.2-6.6 1.4-11.6 5.4-15.4M101 92.6c-3.2-2.8-6.6-3.8-10.2-3.2" />
    </Drawing>
  );
}

// A person looking at a phone, with a pulse on the screen: checking symptoms.
export function PersonWithPhone(props) {
  return (
    <Drawing {...props}>
      {/* head */}
      <path d="M43.6 21.4c7.2-.4 12.8 5 13 12 .2 7.2-5.2 12.8-12.4 12.8-7.2 0-12.6-5.4-12.6-12.4 0-6.8 5-12 12-12.4z" />
      {/* shoulders and body */}
      <path d="M18.4 105.6c-.4-13.6 1.6-24.4 7-32.2 4.4-6.4 11-9.6 18.6-9.6 6.4 0 11.6 2.2 15.6 6.4" />
      <path d="M62.6 89.4c.6 5.4.8 10.8.6 16.2" />
      {/* arm bent up to hold the phone */}
      <path d="M59.6 70.2c3.4 5.4 6 11.4 8.6 17.4 1.6 3.8 5.4 4.6 8.6 1.8 1.6-1.4 2.6-3 3.2-5" />
      {/* phone */}
      <path d="M77.8 37.6l15.6-.6c2.4-.1 3.8 1.3 3.9 3.6l1 33.4c.1 2.4-1.3 3.8-3.6 3.9l-15.6.6c-2.4.1-3.8-1.3-3.9-3.6l-1-33.4c-.1-2.4 1.3-3.8 3.6-3.9z" />
      {/* pulse on the screen */}
      <path d="M77.8 58.4l4.4-.1 2-3.6 3 8.2 2.4-4.8 4.4-.1" />
      {/* thumb on the phone */}
      <path d="M80.4 84.2c-1.2-2.4-.8-4.8 1.2-6.6" />
    </Drawing>
  );
}
