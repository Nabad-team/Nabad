// Small line drawings in one style: teal outlines (sometimes a second, darker teal), round ends, no fills or gradients.
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

// Two hearts: a large heart, and a half-size heart tucked against its lower right side, in front of it.
// Care shared between people (the caregiver spots). The large heart's line ends with a round end a little
// before it meets the small heart, so nothing crosses. The small heart uses the darker teal.
export function TwoHearts(props) {
  return (
    <Drawing {...props}>
      {/* large heart, open where the small heart sits in front of it */}
      <path d="M66.3 72.7C62.1 76.1 57.4 79.3 52.2 82.6C32.7 70.4 18.9 57.5 19.5 42C20 30.9 33.9 25 44 33.6C47.2 36.4 50.1 39.8 52.2 43C54.3 39.8 57.2 36.4 60.5 33.6C70.5 25 84.4 30.9 84.9 42C85.1 48.2 83 54.1 79.2 59.6" />
      {/* small heart, in front */}
      <path className="illustration__strong" d="M86.6 90C76.9 83.9 69.9 77.5 70.3 69.7C70.5 64.2 77.4 61.2 82.5 65.5C84.1 66.9 85.5 68.6 86.6 70.2C87.7 68.6 89.1 66.9 90.7 65.5C95.8 61.2 102.7 64.2 102.9 69.7C103.3 77.5 96.3 83.9 86.6 90Z" />
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
