// "Download my data": a copy of everything Nabad stores about the account, as one JSON file.
// The user confirms it's them first (the password, or the email for Google-only accounts, like account deletion),
// which allows one download from this browser in the next few minutes.

import { request } from "./api";
import { todayString } from "./dates";

export const exportFileName = (date = todayString()) => `nabad-data-${date}.json`;

export async function confirmDataExport(secret, { google = false } = {}) {
  const body = google ? { email: secret } : { password: secret };
  await request("/account/export/confirm", { method: "POST", body: JSON.stringify(body) });
}

// Downloads the file and saves it as nabad-data-YYYY-MM-DD.json (today in the user's time zone).
// Returns the file name.
export async function downloadDataExport() {
  const res = await fetch("/api/account/export", { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.error || "Request failed.");
    error.status = res.status;
    throw error;
  }
  const blob = await res.blob();
  const fileName = exportFileName();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // After the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return fileName;
}
