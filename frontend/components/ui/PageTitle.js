import { HeartbeatDivider } from "./Heartbeat";

// The header row of a page: the h1 with the heartbeat divider and an optional one-line lead on the left,
// and the page's one primary action (plus an optional <MoreMenu />) on the right. On phones they stack.
//   action: the primary <Button>, usually the thing people come to the page to do.
//   more:   a <MoreMenu /> with the secondary actions.
export default function PageTitle({ children, lead, action, more }) {
  const hasActions = Boolean(action || more);
  return (
    <div className={hasActions ? "page-title page-title--with-actions" : "page-title"}>
      <div className="page-title__text">
        <h1>{children}</h1>
        <HeartbeatDivider />
        {lead && <p className="lead">{lead}</p>}
      </div>
      {hasActions && <div className="page-title__actions">{action}{more}</div>}
    </div>
  );
}
