// The accent under a page title: a short spruce bar ending in the pulse dot (28 by 3px, a 6px dot). Static.
export function TitleBar() {
  return <span className="title-bar" aria-hidden="true"><span className="title-bar__dot" /></span>;
}

import { Bone } from "./Skeleton";

// The header row of a page: the h1 with the title bar and an optional one-line lead on the left,
// and the page's one primary action (plus an optional <MoreMenu />) on the right. On phones they stack.
//   action: the primary <Button>, usually the thing people come to the page to do.
//   more:   a <MoreMenu /> with the secondary actions.
//   loadingActions: while the page's data loads and its action or More isn't shown yet, how many button-shaped
//           placeholders hold their place (aria-hidden), so the page doesn't jump when they appear.
export default function PageTitle({ children, lead, action, more, loadingActions = 0 }) {
  const placeholders = Math.max(0, loadingActions - [action, more].filter(Boolean).length);
  const hasActions = Boolean(action || more || placeholders);
  return (
    <div className={hasActions ? "page-title page-title--with-actions" : "page-title"}>
      <div className="page-title__text">
        <h1>{children}</h1>
        <TitleBar />
        {lead && <p className="lead">{lead}</p>}
      </div>
      {hasActions && <div className="page-title__actions">{action}{more}
        {placeholders > 0 && Array.from({ length: placeholders }, (_, index) => <span key={index} className="skeleton page-title__placeholder" aria-hidden="true"><Bone size="button" width={index ? "6rem" : "10rem"} /></span>)}
      </div>}
    </div>
  );
}
