import { useEffect, useRef, useState } from "react";
import Button from "./ui/Button";
import useDisclosure from "./useDisclosure";
import {
  NOTIFICATIONS_CHANGED,
  announceNotificationsChanged,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  timeAgo,
} from "../lib/notificationApi";

const REFRESH_MS = 60 * 1000;
const LATEST = 5;

const unreadText = (count) => (count === 0 ? "No unread notifications" : `${count} unread notification${count === 1 ? "" : "s"}`);

// The unread count, checked every minute, when the tab regains focus, and after a page changes notifications.
// announcement is what the live region says: only changes are spoken, and "no unread" isn't said on page load.
function useUnreadCount() {
  const [count, setCount] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const countRef = useRef(null);

  async function refresh() {
    try {
      const next = await getUnreadCount();
      const previous = countRef.current;
      countRef.current = next;
      setCount(next);
      if (next !== previous && !(previous === null && next === 0)) setAnnouncement(unreadText(next));
    } catch {
      // Offline or signed out: keep the last count. The session timeout handles signing out.
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { count, announcement };
}

// Care circle alerts carry the person's phone number, so the caregiver can call straight away.
export function CallButton({ item }) {
  return (
    <a href={`tel:${item.phone}`} className="button button--secondary button--small notification-call" aria-label={`Call ${item.phone} about "${item.message}"`}>
      Call {item.phone}
    </a>
  );
}

function BellIcon() {
  return (
    <svg className="notification-bell__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

// The header bell: the unread count on a badge, and a panel with the latest five, "Mark all as read" and a link
// to the full history on /notifications. Works with the keyboard like the account menu (see useDisclosure).
export default function NotificationBell() {
  const { count, announcement } = useUnreadCount();
  const panel = useDisclosure();
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState("");

  async function loadLatest() {
    setError("");
    try {
      setLatest((await getNotifications({ limit: LATEST })).notifications);
    } catch {
      setError("We couldn't load your notifications. Please try again.");
    }
  }

  useEffect(() => {
    if (panel.open) loadLatest();
    else setLatest(null);
  }, [panel.open]);

  async function markAll() {
    setError("");
    try {
      await markAllNotificationsRead();
      setLatest((items) => items?.map((item) => ({ ...item, read: true })));
      announceNotificationsChanged();
    } catch {
      setError("We couldn't mark your notifications as read. Please try again.");
    }
  }

  // Opening a notification follows its link (or the full list if it has none) and marks it read on the way.
  function open(item) {
    if (!item.read) markNotificationRead(item.id, { keepalive: true }).catch(() => {});
  }

  const label = count ? `Notifications, ${unreadText(count)}` : "Notifications";
  return (
    <div className="notification-bell">
      <button
        ref={panel.buttonRef}
        type="button"
        className="notification-bell__button"
        aria-expanded={panel.open}
        aria-controls="notification-panel"
        aria-label={label}
        onClick={panel.toggle}
      >
        <BellIcon />
        {count > 0 && <span className="notification-bell__badge" aria-hidden="true">{count > 9 ? "9+" : count}</span>}
      </button>
      <span className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</span>
      {panel.open && (
        <div id="notification-panel" ref={panel.panelRef} className="notification-panel" role="region" aria-labelledby="notification-panel-title">
          <div className="notification-panel__header">
            <p id="notification-panel-title" className="notification-panel__title">Notifications</p>
            <Button variant="secondary" size="small" onClick={markAll} disabled={!count}>Mark all as read</Button>
          </div>
          {error && <p className="field__error" role="alert">{error}</p>}
          {!error && latest === null && <p className="text-muted text-sm">Loading notifications...</p>}
          {latest?.length === 0 && <p className="text-muted text-sm">You have no notifications yet.</p>}
          {latest?.length > 0 && (
            <ul className="notification-panel__list" aria-label="Latest notifications">
              {latest.map((item) => (
                <li key={item.id} className={`notification-panel__entry${item.read ? "" : " notification-panel__entry--unread"}`}>
                  <a href={item.link || "/notifications"} className="notification-panel__item" onClick={() => open(item)}>
                    {!item.read && <span className="visually-hidden">Unread: </span>}
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <span className="text-muted text-sm">{timeAgo(item.createdAt)}</span>
                  </a>
                  {item.phone && <CallButton item={item} />}
                </li>
              ))}
            </ul>
          )}
          <a href="/notifications" className="notification-panel__all">See all notifications</a>
        </div>
      )}
    </div>
  );
}
