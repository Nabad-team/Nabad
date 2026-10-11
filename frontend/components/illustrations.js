// Small line drawings in one style: a single teal outline, round ends, no fills or gradients.
// The lines bend a little on purpose so they feel drawn by hand. Use them on the landing page
// and in empty states, at about 4 to 7rem. They are decorative (hidden from screen readers)
// unless you pass a title. When drawn larger than about 8rem, pass a thinner strokeWidth (e.g. 0.9 at 20rem)
// so the line stays as fine as it looks at the usual size.

// viewBox can crop the 120x120 canvas to the drawing itself (useful at large sizes, see the landing hero).
function Drawing({ size = "6rem", strokeWidth = 2.5, viewBox = "0 0 120 120", title, children }) {
  return (
    <svg
      className="illustration"
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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
// Each hand is one closed outline (thumb, fingers, palm, soft rounded wrist); the right hand mirrors the left,
// and the fingertips just touch in the middle without overlapping.
export function CaregiverHands(props) {
  return (
    <Drawing {...props}>
      {/* heart */}
      <path d="M60 61.2C51.4 55.4 45.6 49.6 46 43.6C46.4 38.4 52.8 36.4 57 40.4C58.4 41.8 59.4 43 60 44.2C60.6 43 61.6 41.8 63 40.4C67.2 36.4 73.6 38.4 74 43.6C74.4 49.6 68.6 55.4 60 61.2Z" />
      {/* left hand */}
      <path d="M16.4 75.6C22.4 75.2 28 73.8 32.2 71.4C35.4 69.4 37.8 65.6 40.2 63.2C42.4 61 45.8 61.8 45.2 65C44.8 67.2 43.4 69.4 43.8 71C44.2 72.6 46.6 73.4 50.2 73.6C52 73.7 53.6 73.8 55 73.9C58.4 74.2 59.6 77 58 79.1C55 82.9 47.6 86 39.8 88.2C31.8 90.4 24 91.2 16.8 91.4C13.6 91.4 11.8 87.8 11.8 83.6C11.8 79.4 13.2 75.8 16.4 75.6Z" />
      {/* right hand */}
      <path d="M103.6 75.6C97.6 75.2 92 73.8 87.8 71.4C84.6 69.4 82.2 65.6 79.8 63.2C77.6 61 74.2 61.8 74.8 65C75.2 67.2 76.6 69.4 76.2 71C75.8 72.6 73.4 73.4 69.8 73.6C68 73.7 66.4 73.8 65 73.9C61.6 74.2 60.4 77 62 79.1C65 82.9 72.4 86 80.2 88.2C88.2 90.4 96 91.2 103.2 91.4C106.4 91.4 108.2 87.8 108.2 83.6C108.2 79.4 106.8 75.8 103.6 75.6Z" />
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
      {/* lid line, one stroke from side to side */}
      <path d="M17.5 55.6c14.2-.5 28.4-.4 42.6-.1 14.2.3 28.4.3 42.6-.3" />
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
      <path d="M100.8 99.6c-.2-6.6 1.4-11.6 5.4-15.4M101.3 93.2c-1.6-1.8-3.4-2.7-5.4-2.8" />
    </Drawing>
  );
}

// A person looking at a phone, with a pulse on the screen: checking symptoms.
export function PersonWithPhone(props) {
  return (
    <Drawing {...props}>
      {/* head */}
      <path d="M43.6 21.4c7.2-.4 12.8 5 13 12 .2 7.2-5.2 12.8-12.4 12.8-7.2 0-12.6-5.4-12.6-12.4 0-6.8 5-12 12-12.4z" />
      {/* shoulders, then the upper arm down to the elbow */}
      <path d="M18.4 105.6c-.4-13.6 1.6-24.4 7-32.2 4.4-6.4 11-9.6 18.6-9.6 6.4 0 11.6 2.2 15.6 6.4C62.6 74 65 82 66 90" />
      {/* side of the body up to the elbow, then the forearm up to the phone's bottom edge */}
      <path d="M66.4 105.6C66.6 100 66.4 95 66 90C70 90.4 76.6 86.6 80.2 78.4" />
      {/* phone */}
      <path d="M77.8 37.6l15.6-.6c2.4-.1 3.8 1.3 3.9 3.6l1 33.4c.1 2.4-1.3 3.8-3.6 3.9l-15.6.6c-2.4.1-3.8-1.3-3.9-3.6l-1-33.4c-.1-2.4 1.3-3.8 3.6-3.9z" />
      {/* pulse on the screen */}
      <path d="M77.8 58.4l4.4-.1 2-3.6 3 8.2 2.4-4.8 4.4-.1" />
    </Drawing>
  );
}
