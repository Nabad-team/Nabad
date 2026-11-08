const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { createTestMongo } = require('./helpers/testMongo');
const User = require('../src/models/User');
const LinkedProfile = require('../src/models/LinkedProfile');
const Medication = require('../src/models/Medication');
const MedicalDocument = require('../src/models/MedicalDocument');
const Appointment = require('../src/models/Appointment');
const Provider = require('../src/models/Provider');
let mongo, server, base, owner, child, other, cookie;
before(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', APP_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:3000', JWT_SECRET: require('crypto').randomBytes(32).toString('hex') });
  mongo = await createTestMongo(); process.env.MONGO_URI = mongo.getUri(); await mongoose.connect(process.env.MONGO_URI);
  server = require('../src/app').createApp().listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/search`;
});
after(async () => { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  await Promise.all([User, LinkedProfile, Medication, MedicalDocument, Appointment, Provider].map(Model => Model.deleteMany({})));
  owner = await User.create({ name: 'Owner', email: 'search@example.test', passwordHash: 'unused' });
  other = await User.create({ name: 'Other', email: 'other@example.test', passwordHash: 'unused' });
  child = await LinkedProfile.create({ owner: owner._id, fullName: 'Child', dateOfBirth: '2020-01-01', relationship: 'child' });
  cookie = jwt.sign({ sub: String(owner._id) }, process.env.JWT_SECRET, { expiresIn: '15m' });
});
async function search(body = { q: 'needle' }, { profileId = 'self', auth = cookie, origin = process.env.CLIENT_ORIGIN } = {}) {
  const r = await fetch(`${base}?profileId=${profileId}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(auth ? { Cookie: `accessToken=${auth}` } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, cache: r.headers.get('cache-control'), body: await r.json() };
}
async function records(account, profileId, prefix = 'Needle') {
  const scope = { owner: account._id, profileId };
  const med = await Medication.create({ ...scope, name: `${prefix} medicine`, startDate: '2026-01-01', notes: 'NEVER RETURN THESE NOTES' });
  const doc = await MedicalDocument.create({ ...scope, filename: `${prefix}.pdf`, documentType: 'lab', mimeType: 'application/pdf', size: 5, data: Buffer.from('bytes') });
  const appointment = await Appointment.create({ ...scope, title: `${prefix} visit`, hospital: 'Central Hospital', appointmentDate: '2026-12-01', appointmentTime: '10:30', notes: 'NEVER RETURN THESE NOTES' });
  return { med, doc, appointment };
}
test('search requires sign-in, trusted origin and an owned selected profile', async () => {
  assert.equal((await search(undefined, { auth: null })).status, 401);
  assert.equal((await search(undefined, { origin: 'https://other.test' })).status, 403);
  for (const profileId of [String(other._id), 'bad', `${child._id}&profileId=self`]) assert.equal((await search(undefined, { profileId })).status, 404);
});
test('finds matching pages and all four data groups using minimal internal result links', async () => {
  const { med, doc, appointment } = await records(owner, owner._id);
  await Provider.create({ slug: 'needle-hospital', name: 'Needle Hospital', type: 'hospital', city: 'Beirut', sources: ['synthetic'], verifiedAt: new Date() });
  const result = await search({ q: '  NeEdLe  ' });
  assert.equal(result.status, 200); assert.equal(result.cache, 'no-store');
  assert.equal(result.body.medications.items[0].href, `/medications#medication-${med._id}`);
  assert.equal(result.body.documents.items[0].href, `/medical-documents#document-${doc._id}`);
  assert.equal(result.body.appointments.items[0].href, `/appointments#appointment-${appointment._id}`);
  assert.equal(result.body.hospitals.items[0].href, '/providers/needle-hospital');
  for (const bucket of Object.values(result.body)) for (const row of bucket.items) assert.ok(Object.keys(row).every(key => ['label', 'detail', 'href'].includes(key)));
  const encoded = JSON.stringify(result.body);
  for (const privateValue of ['NEVER RETURN', 'bytes', 'passwordHash', 'owner', 'profileId']) assert.ok(!encoded.includes(privateValue));
  assert.ok((await search({ q: 'medicine' })).body.pages.items.some(page => page.href === '/medications'));
});
test('never mixes another account or another profile into any private result group', async () => {
  await records(owner, owner._id, 'Needle own'); await records(owner, child._id, 'Needle child'); await records(other, other._id, 'Needle foreign');
  const own = (await search()).body, linked = (await search(undefined, { profileId: String(child._id) })).body;
  for (const type of ['medications', 'documents', 'appointments']) {
    assert.equal(own[type].items.length, 1); assert.match(own[type].items[0].label, /own/);
    assert.equal(linked[type].items.length, 1); assert.match(linked[type].items[0].label, /child/);
  }
});
test('query validation rejects objects, controls, extra keys, blank/short and oversized text', async () => {
  for (const body of [null, [], {}, { q: '' }, { q: ' ' }, { q: 'a' }, { q: 'x'.repeat(81) }, { q: 'bad\u0000value' }, { q: { $ne: '' } }, { q: ['needle'] }, { q: 'needle', owner: String(other._id) }]) assert.equal((await search(body)).status, 400, JSON.stringify(body));
});
test('treats regex characters literally, supports multiple words and returns honest empty results', async () => {
  await records(owner, owner._id, 'Literal [x]');
  assert.equal((await search({ q: '[x]' })).body.documents.items.length, 1);
  assert.ok(Object.values((await search({ q: '.*' })).body).every(bucket => bucket.items.length === 0 && !bucket.hasMore));
  assert.equal((await search({ q: 'literal medicine' })).body.medications.items.length, 1);
});
test('bounds each group and searches hospital names/location without including clinics', async () => {
  await Medication.insertMany(Array.from({ length: 9 }, (_, i) => ({ owner: owner._id, profileId: owner._id, name: `Needle ${i}`, startDate: '2026-01-01' })));
  await Provider.create({ slug: 'central-hospital', name: 'Central Hospital', city: 'Beirut', type: 'hospital', sources: ['synthetic'], verifiedAt: new Date() });
  await Provider.create({ slug: 'central-clinic', name: 'Central Clinic', city: 'Beirut', type: 'clinic', sources: ['synthetic'], verifiedAt: new Date() });
  const result = (await search()).body.medications; assert.equal(result.items.length, 6); assert.equal(result.hasMore, true);
  const hospitals = (await search({ q: 'central beirut' })).body.hospitals;
  assert.equal(hospitals.items.length, 1); assert.equal(hospitals.items[0].label, 'Central Hospital');
});
test('database failures do not claim empty success or echo the search text', async () => {
  const original = Medication.find; Medication.find = () => { throw new Error('private search phrase in a database error'); };
  try { const result = await search({ q: 'private search phrase' }); assert.equal(result.status, 500); assert.ok(!JSON.stringify(result.body).includes('private search phrase')); }
  finally { Medication.find = original; }
});
test('search does not store queries or log submitted text', async () => {
  const output = [], original = process.stdout.write;
  process.stdout.write = function(chunk, ...args) { output.push(String(chunk)); return original.call(this, chunk, ...args); };
  try { assert.equal((await search({ q: 'synthetic-sensitive-query' })).status, 200); }
  finally { process.stdout.write = original; }
  assert.ok(!output.join('').includes('synthetic-sensitive-query'));
  assert.equal(await Medication.countDocuments(), 0); assert.equal(await MedicalDocument.countDocuments(), 0); assert.equal(await Appointment.countDocuments(), 0);
});
test('account-based search rate limit is enforced', async () => {
  for (let i = 0; i < 60; i++) assert.equal((await search()).status, 200);
  assert.equal((await search()).status, 429);
});
