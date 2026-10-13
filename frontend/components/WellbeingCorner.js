import Card from "./ui/Card";

const dailyMessages = [
  "Take things one step at a time today.",
  "A short break can help you reset.",
  "You do not have to handle everything at once.",
  "Try to make time for rest, food, and hydration.",
  "Checking in with someone you trust can help.",
];

function getDailyMessage() {
  const day = new Date().getDate();
  return dailyMessages[day % dailyMessages.length];
}

export default function WellbeingCorner() {
  const dailyMessage = getDailyMessage();

  return (
    <Card
      aria-labelledby="wellbeing-corner-heading"
      className="section"
    >
      <h2 id="wellbeing-corner-heading">
        Wellbeing Corner
      </h2>

      <h3>Today&apos;s message</h3>

      <p>{dailyMessage}</p>

      <h3>Simple wellbeing tips</h3>

      <ul>
        <li>Take a short break if you feel overwhelmed.</li>
        <li>Drink water and try to eat regularly.</li>
        <li>Try slow breathing for a few minutes.</li>
        <li>Talk to someone you trust if you need support.</li>
      </ul>

      <h3>Support in Lebanon</h3>

      <p>
        <strong>National Lifeline 1564</strong>
      </p>

      <p>
        Psychological support and suicide prevention hotline,
        available 24/7 in partnership with Embrace.
      </p>

      <p>
        <a href="tel:1564">
          Call 1564
        </a>
      </p>
    </Card>
  );
}