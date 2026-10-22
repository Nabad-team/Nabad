import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { CallButton } from "../components/NotificationBell";
import { useActiveProfile } from "../context/ActiveProfileContext";
import {
  NOTIFICATIONS_CHANGED,
  announceNotificationsChanged,
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  timeAgo,
} from "../lib/notificationApi";

const PAGE_SIZE = 20;

// The full notification history: newest first, filtered by read state and by person, a page at a time.
export default function NotificationsPage() {
  const { selfProfile, linkedProfiles = [] } = useActiveProfile() || {};
  const [show, setShow] = useState("all");
  const [person, setPerson] = useState("");
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const filterRef = useRef("");
  const ownChangeRef = useRef(false);
  const filterKey = `${show}|${person}`;
  filterRef.current = filterKey;

  const linkedNames = new Map(linkedProfiles.map((profile) => [profile.id, profile.fullName]));

  // Loads pages 1..upTo for the current filters. Refreshing and "Show older" both load from the top, so nothing is
  // skipped or shown twice after notifications were deleted or arrived in the meantime.
  async function load(upTo = 1) {
    const requested = filterRef.current;
    setLoadError("");
    try {
      const pages = await Promise.all(Array.from({ length: upTo }, (_, index) =>
        getNotifications({ page: index + 1, limit: PAGE_SIZE, profileId: person || undefined, unread: show === "unread" })));
      if (filterRef.current !== requested) return;
      const seen = new Set();
      setItems(pages.flatMap((data) => data.notifications).filter((item) => !seen.has(item.id) && seen.add(item.id)));
      setPage(upTo);
      setHasMore(pages[pages.length - 1].hasMore);
    } catch {
      if (filterRef.current !== requested) return;
      if (upTo > page) setError("We couldn't load more notifications. Please try again.");
      else setLoadError("We couldn't load your notifications. Please check your connection and try again.");
    }
  }

  useEffect(() => {
    setItems(null);
    load();
  }, [filterKey]);

  // The header bell's "Mark all as read" changes this list too.
  useEffect(() => {
    const refresh = () => { if (!ownChangeRef.current) load(page); };
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
  }, [filterKey, page]);

  async function loadMore() {
    setError("");
    setLoadingMore(true);
    await load(page + 1);
    setLoadingMore(false);
  }

  async function act(action, success, failure) {
    setError(""); setNotice("");
    try {
      await action();
      setNotice(success);
      // Tells the bell. This page has already updated its own list, so it ignores its own event.
      ownChangeRef.current = true;
      announceNotificationsChanged();
      ownChangeRef.current = false;
    } catch {
      setError(failure);
    }
  }

  const markRead = (item) => act(async () => {
    const updated = await markNotificationRead(item.id);
    setItems((current) => (show === "unread" ? current.filter((n) => n.id !== item.id) : current.map((n) => (n.id === item.id ? updated : n))));
  }, "Notification marked as read.", "We couldn't mark that notification as read. Please try again.");

  const remove = (item) => act(async () => {
    await deleteNotification(item.id);
    setItems((current) => current.filter((n) => n.id !== item.id));
  }, "Notification deleted.", "We couldn't delete that notification. Please try again.");

  const markAll = () => act(async () => {
    await markAllNotificationsRead();
    setItems((current) => (show === "unread" ? [] : current.map((n) => ({ ...n, read: true }))));
  }, "All notifications marked as read.", "We couldn't mark your notifications as read. Please try again.");

  const filtered = show === "unread" || person;
  return (
    <PageLayout title="Notifications" header={<ProfileHeader showPicture={false} />}>
      <PageTitle>Notifications</PageTitle>
      <p className="page-intro">Reminders and alerts from Nabad for you and the people you look after. Notifications are kept for 90 days.</p>
      <p className="text-sm"><a href="/profile#notifications-heading">Choose which notifications you get</a></p>

      <div className="notification-filters" role="group" aria-label="Filter notifications">
        <Input as="select" id="notification-show" label="Show" value={show} onChange={(event) => setShow(event.target.value)}>
          <option value="all">All</option>
          <option value="unread">Unread</option>
        </Input>
        <Input as="select" id="notification-person" label="Person" value={person} onChange={(event) => setPerson(event.target.value)}>
          <option value="">Everyone</option>
          {selfProfile && <option value="self">{selfProfile.fullName} (you)</option>}
          {linkedProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.fullName}</option>)}
        </Input>
        <Button variant="secondary" onClick={markAll} disabled={!items?.some((item) => !item.read)}>Mark all as read</Button>
      </div>

      {notice && <Alert tone="success" as="p" role="status">{notice}</Alert>}
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {loadError && <div className="stack"><Alert tone="danger" as="p" role="alert">{loadError}</Alert><Button variant="secondary" onClick={() => load(page)}>Try again</Button></div>}
      {!loadError && items === null && <HeartbeatLoader label="Loading notifications..." />}
      {items?.length === 0 && (
        <EmptyState title={filtered ? "No notifications match these filters." : "No notifications yet."}>
          {filtered ? "Try showing all notifications or everyone." : "Appointment reminders, care circle alerts and other important alerts will appear here."}
        </EmptyState>
      )}
      {items?.length > 0 && (
        <ul className="notification-list" aria-label="Notifications">
          {items.map((item) => (
            <li key={item.id} className={`notification-item${item.read ? "" : " notification-item--unread"}`}>
              <div className="notification-item__heading">
                <h2 className="notification-item__title">
                  {!item.read && <span className="visually-hidden">Unread: </span>}
                  {item.link ? <a href={item.link}>{item.title}</a> : item.title}
                </h2>
                {!item.read && <span className="badge" aria-hidden="true">New</span>}
              </div>
              <p className="notification-item__message">{item.message}</p>
              <p className="text-muted text-sm">
                {timeAgo(item.createdAt)}
                {linkedNames.has(item.profileId) && ` · ${linkedNames.get(item.profileId)}`}
              </p>
              <div className="button-row">
                {item.phone && <CallButton item={item} />}
                {!item.read && <Button variant="secondary" size="small" onClick={() => markRead(item)} aria-label={`Mark "${item.title}" as read`}>Mark as read</Button>}
                <Button variant="secondary" size="small" onClick={() => remove(item)} aria-label={`Delete "${item.title}"`}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {items?.length > 0 && hasMore && (
        <div className="section"><Button variant="secondary" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading..." : "Show older notifications"}</Button></div>
      )}
    </PageLayout>
  );
}

NotificationsPage.requireSignIn = true;
