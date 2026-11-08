const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { createTestMongo } = require('./helpers/testMongo');
const Medication = require('../src/models/Medication');
const User = require('../src/models/User');
const LinkedProfile = require('../src/models/LinkedProfile');
const Notification = require('../src/models/Notification');
const { nextReminder } = require('../src/medicationSchedule');
const { sendDueMedicationReminders } = require('../src/medicationReminders');
let mongo, server, base, owner, cookie;
const fields = { name: 'Private medication name', dose: '1', startDate: '2026-01-01', reminderTimes: ['20:00', '08:00'], reminderTimeZone: 'Asia/Beirut' };
before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', APP_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:3000', JWT_SECRET: require('crypto').randomBytes(32).toString('hex') });
  mongo = await createTestMongo(); process.env.MONGO_URI = mongo.getUri(); await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Medication.init(), Notification.init()]);
  server = require('../src/app').createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  await Promise.all([Medication.deleteMany({}), User.deleteMany({}), LinkedProfile.deleteMany({}), Notification.deleteMany({})]);
  owner = await User.create({ name: 'Owner', email: 'reminder@example.test', passwordHash: 'unused' });
  cookie = jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET, { expiresIn: '15m' });
});
async function api(method, path, body, auth = cookie) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: process.env.CLIENT_ORIGIN, Cookie: `accessToken=${auth}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
}
async function scheduled(extra = {}) {
  return Medication.create({ ...fields, owner: owner._id, profileId: owner._id, nextReminderAt: new Date('2026-11-08T06:00:00Z'), ...extra });
}

test('separate medications persist sorted custom times; legacy edits preserve them; removing all times disables reminders', async () => {
  const first = await api('POST', '/medications', fields);
  assert.equal(first.status, 201); assert.deepEqual(first.body.medication.reminderTimes, ['08:00', '20:00']);
  const second = await api('POST', '/medications', { ...fields, name: 'Second', reminderTimes: ['12:15'], reminderTimeZone: 'UTC' });
  const list = await api('GET', '/medications');
  assert.deepEqual(list.body.medications.find(m => m.id === second.body.medication.id).reminderTimes, ['12:15']);
  const path = `/medications/${first.body.medication.id}`;
  const { reminderTimes, reminderTimeZone, ...legacy } = fields;
  assert.deepEqual((await api('PUT', path, legacy)).body.medication.reminderTimes, ['08:00', '20:00']);
  const updated = await api('PUT', path, { ...fields, reminderTimes: ['09:45'] });
  assert.deepEqual(updated.body.medication.reminderTimes, ['09:45']);
  assert.ok((await Medication.findById(first.body.medication.id)).nextReminderAt);
  await api('PUT', path, { ...fields, reminderTimes: [] });
  assert.equal((await Medication.findById(first.body.medication.id)).nextReminderAt, null);
  assert.deepEqual((await api('GET', '/medications')).body.medications.find(m => m.id === second.body.medication.id).reminderTimes, ['12:15']);
});
test('invalid, duplicate, injected and excessive schedules are rejected without overwriting saved times', async () => {
  const saved = await api('POST', '/medications', fields);
  const invalid = [null, '08:00', ['8:00'], ['24:00'], ['12:60'], [800], [{}], ['08:00', '08:00'], Array.from({ length: 13 }, (_, i) => `${String(i).padStart(2, '0')}:00`)];
  for (const reminderTimes of invalid) assert.equal((await api('PUT', `/medications/${saved.body.medication.id}`, { ...fields, reminderTimes })).status, 400);
  for (const reminderTimeZone of ['', null, {}, 'Mars/Olympus']) assert.equal((await api('POST', '/medications', { ...fields, reminderTimeZone })).status, 400);
  assert.deepEqual((await api('GET', '/medications')).body.medications[0].reminderTimes, ['08:00', '20:00']);
});
test('schedule writes remain private to the owning account and selected profile', async () => {
  const child = await LinkedProfile.create({ owner: owner._id, fullName: 'Child', dateOfBirth: '2020-01-01', relationship: 'child' });
  const saved = await api('POST', `/medications?profileId=${child._id}`, fields);
  assert.equal(saved.status, 201);
  assert.equal((await api('GET', '/medications')).body.medications.length, 0);
  assert.equal((await api('PUT', `/medications/${saved.body.medication.id}`, fields)).status, 404);
  const other = await User.create({ name: 'Other', email: 'other@example.test', passwordHash: 'unused' });
  const otherCookie = jwt.sign({ sub: String(other._id) }, process.env.JWT_SECRET);
  assert.equal((await api('PUT', `/medications/${saved.body.medication.id}?profileId=${child._id}`, fields, otherCookie)).status, 404);
});
test('next occurrence respects time zones, midnight, dates and daylight saving transitions', () => {
  const med = { ...fields, status: 'active' };
  const next = (after, extra = {}) => nextReminder({ ...med, ...extra }, new Date(after))?.toISOString();
  assert.equal(next('2026-11-08T05:59:00Z'), '2026-11-08T06:00:00.000Z');
  assert.equal(next('2026-07-08T04:59:00Z'), '2026-07-08T05:00:00.000Z');
  assert.equal(next('2026-11-08T23:59:00Z', { reminderTimes: ['00:15'], reminderTimeZone: 'UTC' }), '2026-11-09T00:15:00.000Z');
  assert.equal(next('2026-11-08T00:00:00Z', { startDate: '2026-12-01' }), '2026-12-01T06:00:00.000Z');
  assert.equal(next('2026-11-09T00:00:00Z', { endDate: '2026-11-08' }), undefined);
  assert.equal(next('2026-03-08T05:00:00Z', { reminderTimes: ['02:30'], reminderTimeZone: 'America/New_York' }), '2026-03-09T06:30:00.000Z');
  const repeated = next('2026-11-01T00:00:00Z', { reminderTimes: ['01:30'], reminderTimeZone: 'America/New_York' });
  assert.equal(next(repeated, { reminderTimes: ['01:30'], reminderTimeZone: 'America/New_York' }), '2026-11-02T06:30:00.000Z');
  assert.equal(next('2026-11-08T00:00:00Z', { status: 'discontinued' }), undefined);
});
test('due reminders deliver once across parallel workers, preserve privacy and schedule the next daily time', async () => {
  const med = await scheduled(); const now = new Date('2026-11-08T06:00:30Z');
  await Promise.all([sendDueMedicationReminders(now), sendDueMedicationReminders(now)]);
  const notes = await Notification.find({}); assert.equal(notes.length, 1);
  assert.equal(notes[0].type, 'medication_reminder'); assert.equal(notes[0].link, '/medications');
  assert.ok(!notes[0].message.includes(fields.name));
  assert.equal((await Medication.findById(med._id)).nextReminderAt.toISOString(), '2026-11-08T18:00:00.000Z');
  assert.equal(await sendDueMedicationReminders(now), 0);
  assert.equal(await sendDueMedicationReminders(new Date('2026-11-08T18:00:00Z')), 1);
});
test('muting, discontinuing, ending and deleting stop reminders; resume calculates a future time', async () => {
  const now = new Date('2026-11-08T06:00:30Z');
  const med = await scheduled();
  assert.equal((await api('PUT', '/notifications/preferences', { medication_reminder: false })).status, 200);
  assert.equal(await sendDueMedicationReminders(now), 0);
  assert.equal(await Notification.countDocuments(), 0);
  await api('PATCH', `/medications/${med._id}/status`, { status: 'discontinued' });
  assert.equal((await Medication.findById(med._id)).nextReminderAt, null);
  await api('PATCH', `/medications/${med._id}/status`, { status: 'active' });
  assert.ok((await Medication.findById(med._id)).nextReminderAt > new Date());
  await api('PUT', `/medications/${med._id}`, { ...fields, endDate: '2026-01-02' });
  assert.equal((await Medication.findById(med._id)).nextReminderAt, null);
  await api('DELETE', `/medications/${med._id}`);
  assert.equal(await sendDueMedicationReminders(now), 0);
});
test('stale reminders are skipped after downtime; failures retry and linked reminders use the correct profile', async () => {
  const child = await LinkedProfile.create({ owner: owner._id, fullName: 'Child', dateOfBirth: '2020-01-01', relationship: 'child' });
  const med = await scheduled({ profileId: child._id });
  const now = new Date('2026-11-08T06:00:30Z');
  const original = Notification.updateOne;
  Notification.updateOne = () => { throw new Error('temporary write failure'); };
  try { await assert.rejects(sendDueMedicationReminders(now), /temporary write failure/); }
  finally { Notification.updateOne = original; }
  assert.equal((await Medication.findById(med._id)).nextReminderAt.toISOString(), '2026-11-08T06:00:00.000Z');
  assert.equal(await sendDueMedicationReminders(now), 1);
  assert.equal(String((await Notification.findOne()).profileId), String(child._id));
  await Medication.updateOne({ _id: med._id }, { nextReminderAt: new Date('2026-11-08T06:00:00Z') });
  assert.equal(await sendDueMedicationReminders(new Date('2026-11-08T06:06:00Z')), 0);
  assert.equal((await Medication.findById(med._id)).nextReminderAt.toISOString(), '2026-11-08T18:00:00.000Z');
});
