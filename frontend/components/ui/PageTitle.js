import { HeartbeatDivider } from "./Heartbeat";

// The h1 of a page, with the heartbeat divider under it and an optional lead paragraph.
export default function PageTitle({ children, lead }) {
  return (
    <div className="page-title">
      <h1>{children}</h1>
      <HeartbeatDivider />
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}
