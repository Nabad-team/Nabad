// A sentence with its numbers in the mono font: "500 mg tablet · twice a day" shows "500 mg" in Atkinson Hyperlegible
// Mono (.num) and the words in the normal font. Numbers with their unit (mg, mcg, ml, L, g, IU, hours, puffs) and
// times (08:00) count as one number.
//
// Screen readers (and tests) get the whole sentence once, as one piece of text; the styled copy is aria-hidden.
// Every visible piece is its own span, so no fragment repeats the sentence.
const NUMBER = /(\d+(?:[.:]\d+)?(?:\s?(?:mcg|mg|ml|L|g|IU|hours?|puffs?)\b)?)/;

export default function NumText({ children }) {
  const text = String(children ?? "");
  const parts = text.split(NUMBER).filter(Boolean);
  if (!parts.some((part) => NUMBER.test(part))) return text;
  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">
        {parts.map((part, index) => <span key={index} className={NUMBER.test(part) ? "num" : undefined}>{part}</span>)}
      </span>
    </>
  );
}
