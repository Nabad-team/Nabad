const crypto = require("crypto");
const CareCircle = require("./models/CareCircle");
const LinkedProfile = require("./models/LinkedProfile");
const User = require("./models/User");
const { notify } = require("./notifications");
const { sendEmail } = require("./email");
const { logEvent, errorDetails } = require("./logger");

// Care circle alerts. After a symptom check (routes/triage.js), every active member of the inviter's circle is told
// that the check needs attention, in the app (notify(), caregiver_urgent: always on) and by email. Only the person's
// name and the urgency level are said, plus the inviter's phone number if they saved one: never symptoms, answers
// or any other health detail, and nothing about the check is logged.
const ALERT_LEVELS = ["urgent", "emergency"];
// Without a check id from the browser, one alert per profile in this window.
const FALLBACK_WINDOW_MS = 10 * 60 * 1000;
const NAME_LENGTH = 40;

const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const origin = () => process.env.CLIENT_ORIGIN || "http://localhost:3000";
// For one line of an email or notification: no line breaks, and short enough for the 200-character message.
const shortName = (name) => {
  const clean = String(name || "").replace(/\s+/g, " ").trim();
  return clean.length > NAME_LENGTH ? `${clean.slice(0, NAME_LENGTH - 1)}…` : clean;
};

function alertText({ inviterName, personName, level }) {
  const message = personName === inviterName
    ? `${inviterName}'s symptom check needs attention (${level}).`
    : `${personName}'s symptom check needs attention (${level}), from ${inviterName}'s account.`;
  return { title: "Care circle alert", message };
}

function alertEmail({ to, inviterName, message, phone }) {
  return {
    to,
    subject: `Care circle alert from ${inviterName}`,
    text: [
      message,
      ...(phone ? [`You can call ${inviterName} on ${phone}.`] : []),
      `Open Nabad: ${origin()}/notifications`,
      "If you think someone is in danger, call 140 now.",
      `You get this email because ${inviterName} added you to their care circle on Nabad. Nabad never shares their symptoms or health details with you.`,
    ].join("\n\n"),
  };
}

function inviteEmail({ to, inviterName, inviterEmail, token }) {
  return {
    to,
    subject: `${inviterName} invited you to their Nabad care circle`,
    text: [
      `${inviterName} (${inviterEmail}) would like you to be in their care circle on Nabad.`,
      `People in a care circle are told when one of ${inviterName}'s symptom checks needs attention (urgent or emergency). They never see symptoms or health details.`,
      `To accept, open this link within 7 days and sign in, or create an account, with this email address (${to}):\n${origin()}/care-circle/accept?token=${token}`,
      `If you don't know ${inviterName} or don't want to join, you can ignore this email.`,
    ].join("\n\n"),
  };
}

// One alert per check: the browser sends the same checkId with a check and its follow-up answers.
function checkKey(owner, profileId, checkId, now) {
  const check = typeof checkId === "string" && /^[\w-]{8,64}$/.test(checkId) ? hash(checkId) : `t${Math.floor(now / FALLBACK_WINDOW_MS)}`;
  return `care:${owner}:${profileId}:${check}`;
}

// Tells the inviter's care circle when a symptom check came out urgent or an emergency. Returns how many members
// were told (0 for other levels, an empty circle, or a check that was already alerted).
async function alertCareCircle({ requestId, owner, profileId, level, checkId, now = Date.now() }) {
  if (!ALERT_LEVELS.includes(level)) return 0;
  const memberships = await CareCircle.find({ inviter: owner, status: "active" }).select("member").lean();
  if (!memberships.length) return 0;
  const inviter = await User.findById(owner).select("name phone").lean();
  if (!inviter) return 0;
  const self = String(profileId) === String(owner);
  const linked = self ? null : await LinkedProfile.findOne({ _id: profileId, owner }).select("fullName").lean();
  if (!self && !linked) return 0;

  const inviterName = shortName(inviter.name);
  const { title, message } = alertText({ inviterName, personName: self ? inviterName : shortName(linked.fullName), level });
  const phone = inviter.phone || "";
  const dedupeKey = checkKey(owner, profileId, checkId, now);
  const members = await User.find({ _id: { $in: memberships.map((item) => item.member) } }).select("email").lean();
  let alerted = 0;
  for (const member of members) {
    const created = await notify(member._id, "self", "caregiver_urgent", { title, message, link: "/notifications", phone, dedupeKey });
    if (!created) continue;
    alerted += 1;
    sendEmail({ requestId }, alertEmail({ to: member.email, inviterName, message, phone }), "care_circle_alert_email_not_sent");
  }
  logEvent("care_circle_alerted", { requestId, reason: `members:${alerted}` });
  return alerted;
}

// For the triage route: runs after the response and never fails the request.
function alertCareCircleInBackground(fields) {
  return alertCareCircle(fields).catch((error) => logEvent("care_circle_alert_failed", { requestId: fields.requestId, ...errorDetails(error) }));
}

// Account deletion: the circles the account invited people to, and its places in other people's circles.
async function deleteCareCircles(userId) {
  await CareCircle.deleteMany({ $or: [{ inviter: userId }, { member: userId }] });
}

module.exports = { alertCareCircle, alertCareCircleInBackground, deleteCareCircles, alertText, inviteEmail, shortName, hash, ALERT_LEVELS };
