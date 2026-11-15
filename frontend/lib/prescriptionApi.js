import { request } from "./api";

// SCRUM-146: read a prescription photo into the medication list (backend: routes/prescriptions.js).
// Nothing is saved by readPrescription; applyPrescription saves the medicines the person kept.

export const PRESCRIPTION_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // the server's limit
const MAX_SIDE = 2000; // phone photos are resized to this, which keeps prescription text readable

const path = (action, profileId) => `/prescriptions/${action}?profileId=${encodeURIComponent(profileId)}`;

function toBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

// A phone photo is often larger than 3 MB: make it a smaller JPEG in the browser first. Returns the
// original file when it is already small, isn't a photo, or the browser can't resize it.
export async function shrinkPhoto(file) {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  if (file.size <= MAX_UPLOAD_BYTES * 0.8) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "prescription.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export async function readPrescription(profileId, file, signal) {
  const ready = await shrinkPhoto(file);
  if (ready.size > MAX_UPLOAD_BYTES) {
    const error = new Error("This file is larger than 3 MB. Take the photo again closer to the prescription, or use a smaller file.");
    error.status = 413;
    throw error;
  }
  const bytes = new Uint8Array(await ready.arrayBuffer());
  const extension = ready.type === "application/pdf" ? "pdf" : ready.type.split("/")[1];
  return request(path("read", profileId), {
    method: "POST", signal,
    body: JSON.stringify({ consent: true, file: { mimeType: ready.type, extension, data: toBase64(bytes) } }),
  });
}

export const applyPrescription = (profileId, items) =>
  request(path("apply", profileId), { method: "POST", body: JSON.stringify({ items }) });

// "2026-11-11" + 7 days -> "2026-11-17" (the last day it is taken).
export function endDateFor(startDate, durationDays) {
  if (!startDate || !Number.isInteger(durationDays) || durationDays < 1) return "";
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + durationDays - 1);
  return date.toISOString().slice(0, 10);
}
