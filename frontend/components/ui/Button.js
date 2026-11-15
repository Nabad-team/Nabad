// The one button for the whole app. variant: "primary" (the main action on a screen, usually one),
// "secondary" (other actions, Cancel, Back), "danger-quiet" (Delete on a list row: red text and outline)
// or "danger" (solid red, only for the final step that deletes data, e.g. "Yes, delete").
// Pass href to get a link that looks like a button (navigation should stay a link).
// Every button is at least 44px tall, so it is easy to tap.
import Link from "next/link";

export default function Button({ variant = "primary", size, block = false, href, className = "", type = "button", ...props }) {
  const classes = ["button", `button--${variant}`, size === "small" && "button--small", block && "button--block", className]
    .filter(Boolean)
    .join(" ");
  if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !/^\/api(?:\/|\?|$)/.test(href) && props.download === undefined) return <Link href={href} className={classes} {...props} />;
  if (href !== undefined) return <a href={href} className={classes} {...props} />;
  return <button type={type} className={classes} {...props} />;
}
