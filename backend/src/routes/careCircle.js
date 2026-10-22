const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const validator = require("validator");
const CareCircle = require("../models/CareCircle");
const User = require("../models/User");
const { requireAuth } = require("../middleware/authMiddleware");
const { mailer, sendInBackground, fromAddress } = require("../email");
const { notify } = require("../notifications");
const { inviteEmail, shortName, hash } = require("../careCircle");
const { logEvent } = require("../logger");
const { UserError, sendError } = require("../userError");

const { MAX_MEMBERS, INVITE_DAYS } = CareCircle;
// The signed-in user's care circle (the people they invited) and the circles they are in.
// Every query filters by inviter = req.userId or member = req.userId, so nobody can see or change another's circle.
// Inviting never looks up whether the email has a Nabad account, so the answer can't tell.
const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch((error) => (error instanceof UserError ? sendError(req, res, error) : next(error)));
const limit = (windowMinutes, max, message, keyGenerator) => rateLimit({ windowMs: windowMinutes * 60 * 1000, max, ...(keyGenerator ? { keyGenerator } : {}), message: { error: message } });
const byUser = (req) => req.userId;
// Each invitation is an email to an address the user typed, so few are allowed.
const inviteLimiter = limit(60, 10, "Too many invitations in a short time. Please wait an hour and try again.", byUser);
const writeLimiter = limit(15, 60, "Too many changes in a short time. Please wait a few minutes and try again.", byUser);
const readLimiter = limit(15, 200, "Too many requests in a short time. Please wait a few minutes and try again.", byUser);
const lookupLimiter = limit(15, 30, "Too many requests in a short time. Please wait a few minutes and try again.");

const INVALID_INVITE = { error: "This invitation link is invalid or has already been used. Ask the person who invited you to send a new one." };
const EXPIRED_INVITE = { error: "This invitation has expired. Ask the person who invited you to send a new one." };
const NOT_FOUND = { error: "Not found." };
const INVITE_MS = INVITE_DAYS * 24 * 60 * 60 * 1000;

const validToken = (token) => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
const ownedFilter = (req, field, status) => (mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id, [field]: req.userId, status } : null);
const pendingView = (invite) => ({ id: String(invite._id), email: invite.inviteEmail, sentAt: invite.updatedAt, expiresAt: invite.expiresAt });
const memberView = (entry) => ({ id: String(entry._id), name: entry.member.name, email: entry.member.email, since: entry.acceptedAt });
const circleView = (entry, inviter) => ({ id: String(entry._id), name: inviter.name, since: entry.acceptedAt });

// The pending invitation behind a token, for the accept page. No sign-in needed: the visitor may have to sign in or
// create an account first. Only the token holder (the person the email went to) learns who invited them.
router.post("/invites/lookup", lookupLimiter, asyncRoute(async (req, res) => {
  const { token } = req.body || {};
  if (!validToken(token)) return res.status(400).json(INVALID_INVITE);
  const invite = await CareCircle.findOne({ inviteTokenHash: hash(token), status: "pending" }).populate("inviter", "name");
  if (!invite || !invite.inviter) return res.status(400).json(INVALID_INVITE);
  if (invite.expiresAt <= new Date()) return res.status(400).json(EXPIRED_INVITE);
  return res.json({ invite: { inviterName: invite.inviter.name, email: invite.inviteEmail, expiresAt: invite.expiresAt } });
}));

router.use(requireAuth);

router.get("/", readLimiter, asyncRoute(async (req, res) => {
  const [entries, joined] = await Promise.all([
    CareCircle.find({ inviter: req.userId }).sort({ createdAt: 1, _id: 1 }).populate("member", "name email"),
    CareCircle.find({ member: req.userId, status: "active" }).sort({ acceptedAt: 1, _id: 1 }).populate("inviter", "name"),
  ]);
  const now = new Date();
  return res.json({
    members: entries.filter((entry) => entry.status === "active" && entry.member).map(memberView),
    pending: entries.filter((entry) => entry.status === "pending" && entry.expiresAt > now).map(pendingView),
    circles: joined.filter((entry) => entry.inviter).map((entry) => circleView(entry, entry.inviter)),
    maxMembers: MAX_MEMBERS,
  });
}));

// Body: { email }. Emails a one-time link (valid 7 days). Inviting the same address again sends a new link and
// cancels the old one. The answer is the same whether or not the address has a Nabad account.
router.post("/invites", inviteLimiter, asyncRoute(async (req, res) => {
  const raw = req.body?.email;
  if (typeof raw !== "string" || raw.length > 254 || !validator.isEmail(raw.trim())) return res.status(400).json({ error: "Enter a valid email address." });
  const email = raw.trim().toLowerCase();
  const inviter = await User.findById(req.userId).select("name email");
  if (!inviter) return res.status(401).json({ error: "Not authenticated." });
  if (email === inviter.email) return res.status(400).json({ error: "You can't invite yourself to your own care circle." });
  if (await CareCircle.exists({ inviter: inviter._id, status: "active", inviteEmail: email })) return res.status(409).json({ error: `${email} is already in your care circle.` });
  const now = new Date();
  const taken = await CareCircle.countDocuments({ inviter: inviter._id, inviteEmail: { $ne: email }, $or: [{ status: "active" }, { status: "pending", expiresAt: { $gt: now } }] });
  if (taken >= MAX_MEMBERS) return res.status(400).json({ error: `Your care circle can have up to ${MAX_MEMBERS} people, invitations included. Remove someone or cancel an invitation first.` });
  // Before saving anything: an invitation that can't be emailed would only confuse.
  const transport = mailer();

  const token = crypto.randomBytes(32).toString("hex");
  let invite;
  try {
    invite = await CareCircle.findOneAndUpdate(
      { inviter: inviter._id, inviteEmail: email, status: "pending" },
      { $set: { inviteTokenHash: hash(token), expiresAt: new Date(now.getTime() + INVITE_MS) }, $setOnInsert: { inviter: inviter._id, inviteEmail: email, status: "pending" } },
      { upsert: true, new: true, runValidators: true }
    );
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: `An invitation to ${email} was just sent.` });
    throw error;
  }
  sendInBackground(req, transport, { from: fromAddress(), ...inviteEmail({ to: email, inviterName: shortName(inviter.name), inviterEmail: inviter.email, token }) });
  logEvent("care_circle_invited", { requestId: req.requestId });
  return res.status(202).json({ message: `Invitation sent to ${email}. It expires in ${INVITE_DAYS} days.`, invite: pendingView(invite) });
}));

// Body: { token }. Only the account with the invited email can accept, and each link works once.
router.post("/invites/accept", writeLimiter, asyncRoute(async (req, res) => {
  const { token } = req.body || {};
  if (!validToken(token)) return res.status(400).json(INVALID_INVITE);
  const user = await User.findById(req.userId).select("name email");
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  const invite = await CareCircle.findOne({ inviteTokenHash: hash(token), status: "pending" }).populate("inviter", "name");
  if (!invite || !invite.inviter) return res.status(400).json(INVALID_INVITE);
  if (invite.expiresAt <= new Date()) return res.status(400).json(EXPIRED_INVITE);
  const inviterId = invite.inviter._id;
  if (String(inviterId) === String(user._id)) return res.status(400).json({ error: "This is an invitation to your own care circle. Send the link to the person you invited." });
  if (invite.inviteEmail !== user.email) {
    return res.status(403).json({ error: `This invitation was sent to ${invite.inviteEmail}. Sign in with that email address to accept it.` });
  }
  const existing = await CareCircle.findOne({ inviter: inviterId, member: user._id, status: "active" });
  if (existing) {
    await CareCircle.deleteOne({ _id: invite._id });
    return res.json({ circle: circleView(existing, invite.inviter), message: `You're already in ${invite.inviter.name}'s care circle.` });
  }
  if (await CareCircle.countDocuments({ inviter: inviterId, status: "active" }) >= MAX_MEMBERS) {
    return res.status(409).json({ error: `${invite.inviter.name}'s care circle is full. Ask them to make room and send a new invitation.` });
  }
  // The token is checked and removed in one atomic step, so it can only be used once.
  const accepted = await CareCircle.findOneAndUpdate(
    { _id: invite._id, inviteTokenHash: hash(token), status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "active", member: user._id, acceptedAt: new Date() }, $unset: { inviteTokenHash: 1, expiresAt: 1 } },
    { new: true }
  ).catch((error) => { if (error.code === 11000) return null; throw error; });
  if (!accepted) return res.status(400).json(INVALID_INVITE);
  logEvent("care_circle_joined", { requestId: req.requestId });
  // Tells the inviter. Joining must not fail because of it.
  await notify(inviterId, "self", "system", {
    title: "Care circle", message: `${shortName(user.name)} joined your care circle.`, link: "/care-circle", dedupeKey: `care-joined:${accepted._id}`,
  }).catch(() => {});
  return res.json({ circle: circleView(accepted, invite.inviter), message: `You're now in ${invite.inviter.name}'s care circle.` });
}));

// The inviter cancels a pending invitation (its link stops working) or removes a member.
router.delete("/invites/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req, "inviter", "pending");
  if (!filter || !(await CareCircle.deleteOne(filter)).deletedCount) return res.status(404).json(NOT_FOUND);
  return res.status(204).end();
}));
router.delete("/members/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req, "inviter", "active");
  if (!filter || !(await CareCircle.deleteOne(filter)).deletedCount) return res.status(404).json(NOT_FOUND);
  return res.status(204).end();
}));
// A member leaves a circle they are in.
router.delete("/circles/:id", writeLimiter, asyncRoute(async (req, res) => {
  const filter = ownedFilter(req, "member", "active");
  if (!filter || !(await CareCircle.deleteOne(filter)).deletedCount) return res.status(404).json(NOT_FOUND);
  return res.status(204).end();
}));

module.exports = router;
