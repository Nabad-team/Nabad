const nodemailer = require("nodemailer");
const { cookieOptions } = require("./config");
const { logEvent } = require("./logger");
const { UserError } = require("./userError");

// The email service: one SMTP transport per message, configured from the environment.
const SMTP_TIMEOUT_MS = 10 * 1000;
const fromAddress = () => process.env.MAIL_FROM || process.env.EMAIL_FROM;

function mailer() {
  const from = fromAddress();
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !from) throw new UserError("Sending email is temporarily unavailable. Please try again later.", 503);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", requireTLS: cookieOptions().secure,
    connectionTimeout: SMTP_TIMEOUT_MS, greetingTimeout: SMTP_TIMEOUT_MS, socketTimeout: SMTP_TIMEOUT_MS,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
// Email is never awaited by a request: a slow or blocked SMTP server must not hold the response.
// Only the error name and code are logged; SMTP error messages can echo server responses.
function logEmailFailure(req, error) {
  logEvent("email_failed", { requestId: req?.requestId, errorType: error?.name || "Error", errorCode: error?.code });
}
function sendInBackground(req, transport, message) {
  transport.sendMail(message).catch((error) => logEmailFailure(req, error));
}
// Sends without ever failing the caller: when email isn't configured, logs `notSentEvent` and returns false.
function sendEmail(req, message, notSentEvent = "email_not_sent") {
  let transport;
  try { transport = mailer(); } catch { logEvent(notSentEvent, { requestId: req?.requestId, reason: "email_not_configured" }); return false; }
  sendInBackground(req, transport, { from: fromAddress(), ...message });
  return true;
}

module.exports = { mailer, logEmailFailure, sendInBackground, sendEmail, fromAddress };
