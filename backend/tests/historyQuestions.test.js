// SCRUM-156: "As a user, I want to ask natural-language questions about my own history so that I can recall
// past symptoms or visits."
//
// Part 1: understanding the question (no database). Part 2: finding the records and answering, with a
// temporary MongoDB. Part 3: POST /api/history/ask over HTTP, with and without a fake AI provider.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { createTestMongo } = require("./helpers/testMongo");
const { LlmError } = require("../src/triage/ai/llmClient");
const { parseQuestion, answerHistoryQuestion, parseAiAnswer, HistoryAnswerError } = require("../src/historyQuestions");

const NOW = new Date("2026-11-11T10:00:00Z"); // a Wednesday
const ask = (question, options = {}) => parseQuestion(question, { now: NOW, ...options });

// ---------------------------------------------------------------------------------------------
describe("understanding the question", () => {
  test("the period it asks about, in the person's time zone", () => {
    const period = (q) => ask(q).period;
    assert.deepEqual(period("what did I check today"), { from: "2026-11-11", to: "2026-11-11", label: "today" });
    assert.deepEqual(period("anything yesterday?"), { from: "2026-11-10", to: "2026-11-10", label: "yesterday" });
    assert.deepEqual(period("symptoms this week"), { from: "2026-11-09", to: "2026-11-11", label: "this week" });
    assert.deepEqual(period("visits last week"), { from: "2026-11-02", to: "2026-11-08", label: "last week" });
    assert.deepEqual(period("last month"), { from: "2026-10-01", to: "2026-10-31", label: "last month (October 2026)" });
    assert.deepEqual(period("this year"), { from: "2026-01-01", to: "2026-11-11", label: "this year (2026)" });
    assert.deepEqual(period("in the past 2 weeks"), { from: "2026-10-29", to: "2026-11-11", label: "the past 2 weeks" });
    assert.deepEqual(period("over the last three days"), { from: "2026-11-09", to: "2026-11-11", label: "the past 3 days" });
    assert.deepEqual(period("a month ago"), { from: "2026-09-27", to: "2026-10-27", label: "about 1 month ago" });
    assert.deepEqual(period("lately"), { from: "2026-10-13", to: "2026-11-11", label: "the past 30 days" });
    assert.deepEqual(period("in March"), { from: "2026-03-01", to: "2026-03-31", label: "March 2026" });
    assert.deepEqual(period("in december"), { from: "2025-12-01", to: "2025-12-31", label: "December 2025" }, "a month that hasn't come yet this year means last year's");
    assert.deepEqual(period("february 2024"), { from: "2024-02-01", to: "2024-02-29", label: "February 2024" });
    assert.deepEqual(period("since September"), { from: "2026-09-01", to: "2026-11-11", label: "since September 2026" });
    assert.deepEqual(period("in 2025"), { from: "2025-01-01", to: "2025-12-31", label: "2025" });
    assert.equal(period("when did I last have a headache"), null, "no period: all of the history");
    assert.equal(period("I may have had a rash"), null, "'may' is not May");
    assert.equal(period("my marching band injury"), null);
    // Late on the 31st in UTC is already the 1st in Beirut.
    assert.equal(parseQuestion("today", { now: new Date("2026-10-31T23:30:00Z"), timeZone: "Asia/Beirut" }).period.from, "2026-11-01");
    assert.equal(parseQuestion("today", { now: new Date("2026-10-31T23:30:00Z"), timeZone: "Nowhere/Invalid" }).timeZone, "Asia/Beirut");
  });

  test("what kind of record, and what it asks for", () => {
    assert.deepEqual(ask("When did I last have a headache?").kinds, ["symptoms", "visits"]);
    assert.deepEqual(ask("how many times did I see a doctor this year").kinds, ["visits"]);
    assert.deepEqual(ask("what medicines was I taking in March").kinds, ["medications"]);
    assert.deepEqual(ask("did I upload my lab results").kinds, ["documents"]);
    assert.equal(ask("When did I last have a headache?").intent, "last");
    assert.equal(ask("how many times did I have a fever").intent, "count");
    assert.equal(ask("when was the first time I had a rash").intent, "first");
    assert.equal(ask("my symptoms in March").intent, "list");
  });

  test("the words to look for, with plurals and everyday synonyms", () => {
    const words = (q) => ask(q).keywords.map((k) => k.word);
    assert.deepEqual(words("When did I last have headaches?"), ["headache"]);
    assert.deepEqual(words("how many times did I see a doctor about my back this year"), ["back"]);
    assert.deepEqual(words("what did I check in March"), []);
    assert.deepEqual(ask("my tummy pain").keywords.find((k) => k.word === "tummy").any, ["stomach", "belly", "tummy", "abdomen", "abdominal"]);
  });
});

describe("checking an AI answer", () => {
  const records = [{ id: "a1" }, { id: "b2" }];
  test("keeps an answer that cites only the records it was given", () => {
    assert.deepEqual(parseAiAnswer('{"answer":"Your last headache check was on 3 October 2026.","sources":["a1","a1"]}', records), { answer: "Your last headache check was on 3 October 2026.", sources: ["a1"] });
    assert.equal(parseAiAnswer('{"answer":"You were taking Amoxicillin 500 mg in March.","sources":["b2"]}', records).answer, "You were taking Amoxicillin 500 mg in March.");
  });
  test("rejects made-up sources, no sources, advice, diagnoses, reassurance, links and phone numbers", () => {
    const rejects = (raw, code) => assert.throws(() => parseAiAnswer(raw, records), (e) => e instanceof HistoryAnswerError && e.code === code, raw);
    rejects('{"answer":"On 1 May you had a fever.","sources":["zz9"]}', "unknown_source");
    rejects('{"answer":"You had a headache.","sources":[]}', "no_sources");
    rejects('{"answer":"You probably have migraines.","sources":["a1"]}', "unsafe:advice");
    rejects('{"answer":"Your diagnosis is migraine.","sources":["a1"]}', "unsafe:certain_diagnosis");
    rejects('{"answer":"It was nothing to worry about.","sources":["a1"]}', "unsafe:false_reassurance");
    rejects('{"answer":"See www.example.com.","sources":["a1"]}', "unsafe:link");
    rejects('{"answer":"Call 01 234 567.","sources":["a1"]}', "unsafe:phone_number");
    rejects("I can't help with that", "unparseable");
  });
});

// ---------------------------------------------------------------------------------------------
describe("finding the records and answering", () => {
  let mongo, User, SymptomRecord, Appointment, Medication, MedicalDocument, LinkedProfile;
  let me, other, child;
  before(async () => {
    mongo = await createTestMongo();
    await mongoose.connect(mongo.getUri());
    ({ User, SymptomRecord, Appointment, Medication, MedicalDocument, LinkedProfile } = {
      User: require("../src/models/User"), SymptomRecord: require("../src/models/SymptomRecord"), Appointment: require("../src/models/Appointment"),
      Medication: require("../src/models/Medication"), MedicalDocument: require("../src/models/MedicalDocument"), LinkedProfile: require("../src/models/LinkedProfile"),
    });
    me = await User.create({ name: "Me", email: "me@example.test", passwordHash: "x" });
    other = await User.create({ name: "Other", email: "other@example.test", passwordHash: "x" });
    child = await LinkedProfile.create({ owner: me._id, fullName: "Sami", relationship: "child", dateOfBirth: new Date("2019-01-01") });
    const check = (owner, profileId, description, createdAt, label = "See a doctor soon") =>
      SymptomRecord.collection.insertOne({ owner, profileId, description, urgencyResult: { level: "soon", label }, conversation: [], createdAt: new Date(createdAt), updatedAt: new Date(createdAt) });
    await check(me._id, me._id, "bad headache behind my eyes", "2026-10-03T08:00:00Z");
    await check(me._id, me._id, "headache and a runny nose", "2026-03-12T08:00:00Z", "Routine / self-care");
    await check(me._id, me._id, "my tummy hurts after eating", "2026-10-28T08:00:00Z");
    await check(me._id, me._id, "stomach ache and vomiting", "2026-10-30T21:30:00Z"); // 31 Oct in Beirut
    await check(me._id, me._id, "rash on my arm", "2026-10-31T23:30:00Z"); // 1 Nov in Beirut
    await check(me._id, child._id, "Sami has a headache and fever", "2026-11-05T08:00:00Z");
    await check(other._id, other._id, "OTHER PERSON headache", "2026-11-01T08:00:00Z");
    const visit = (fields) => Appointment.create({ owner: me._id, profileId: me._id, hospital: "AUBMC", appointmentTime: "10:00", ...fields });
    await visit({ title: "Cardiology check-up", appointmentDate: "2026-02-10" });
    await visit({ title: "GP visit about back pain", hospital: "Clemenceau Medical Center", appointmentDate: "2026-09-15", notes: "bring x-ray" });
    await visit({ title: "Dentist", hospital: "Smile Clinic", appointmentDate: "2026-10-20" });
    await visit({ title: "Cardiology follow-up", appointmentDate: "2026-12-01" }); // upcoming
    await Medication.create({ owner: me._id, profileId: me._id, name: "Amoxicillin", dose: "500", unit: "mg", frequency: "three times a day", startDate: new Date("2026-03-10"), endDate: new Date("2026-03-17"), status: "discontinued" });
    await Medication.create({ owner: me._id, profileId: me._id, name: "Vitamin D", dose: "1000", unit: "IU", frequency: "once a day", startDate: new Date("2026-06-01") });
    await MedicalDocument.create({ owner: me._id, profileId: me._id, filename: "cbc-results.pdf", mimeType: "application/pdf", documentType: "lab", documentDate: new Date("2026-09-20"), size: 3, data: Buffer.from("pdf") });
    await MedicalDocument.create({ owner: me._id, profileId: me._id, filename: "card-front.jpg", mimeType: "image/jpeg", documentType: "insurance_card", documentDate: new Date("2026-08-01"), size: 3, data: Buffer.from("jpg") });
  }, { timeout: 240000 });
  after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

  const answer = (question, options = {}) => answerHistoryQuestion({ owner: me._id, profileId: me._id, question, timeZone: "Asia/Beirut", now: NOW, ...options });

  test("when did I last have a headache: the most recent, then the others", async () => {
    const result = await answer("When did I last have a headache?");
    assert.equal(result.answeredBy, "search");
    assert.deepEqual(result.records.map((r) => r.day), ["2026-10-03", "2026-03-12"]);
    assert.equal(result.answer, 'The most recent one mentioning "headache": on 3 October 2026 you described: "bad headache behind my eyes" (result: See a doctor soon). There is 1 other below.');
    assert.equal(result.records[0].type, "symptom-check");
  });

  test("synonyms: a question about the stomach finds 'tummy' too, and a period in the person's time zone", async () => {
    const result = await answer("stomach problems in October");
    assert.deepEqual(result.records.map((r) => r.detail), ["stomach ache and vomiting", "my tummy hurts after eating"]);
    assert.equal(result.answer, 'I found 2 symptom checks mentioning "stomach" in October 2026.');
    // The rash at 23:30 UTC on 31 October was on 1 November in Beirut.
    assert.deepEqual((await answer("what did I check this month")).records.map((r) => r.detail), ["rash on my arm"]);
    assert.deepEqual((await answer("what did I check this month", { timeZone: "UTC" })).records.map((r) => r.detail), []);
  });

  test("visits: counts, past only for 'last', and upcoming ones marked", async () => {
    const count = await answer("How many times did I see a doctor this year?");
    // February, September and October: the December follow-up is still to come.
    assert.equal(count.answer, "You have 3 visits this year (2026).");
    const last = await answer("when was my last visit to the cardiologist");
    assert.deepEqual(last.records.map((r) => r.title), ["Cardiology check-up"], "the December follow-up hasn't happened yet");
    assert.match(last.answer, /The most recent one mentioning "cardiologist": on 10 February 2026 at 10:00: Cardiology check-up, AUBMC\./);
    const all = await answer("cardiology appointments");
    assert.equal(all.records[0].result, "Upcoming");
    assert.equal(all.records[0].href, `/appointments#appointment-${all.records[0].id}`);
  });

  test("medications taken during a month, and documents", async () => {
    const meds = await answer("what medicines was I taking in March");
    assert.deepEqual(meds.records.map((r) => [r.title, r.detail, r.result]), [["Amoxicillin", "500 mg, three times a day", "Stopped 17 March 2026"]]);
    const now = await answer("which medications am I taking this month");
    assert.deepEqual(now.records.map((r) => r.title), ["Vitamin D"]);
    const docs = await answer("did I upload any lab results since September");
    assert.deepEqual(docs.records.map((r) => [r.title, r.detail]), [["cbc-results.pdf", "Lab result"]]);
    const card = await answer("where is my insurance card document");
    assert.deepEqual(card.records.map((r) => [r.title, r.detail]), [["card-front.jpg", "Insurance card"]]);
  });

  test("the first time, and nothing found", async () => {
    assert.equal((await answer("when was the first time I had a headache")).records[0].day, "2026-03-12");
    const none = await answer("when did I last have a nosebleed?");
    assert.deepEqual(none.records, []);
    assert.equal(none.answer, `I couldn't find any symptom checks or visits mentioning "nosebleed" in your Nabad history. It only includes what was saved in Nabad: symptom checks, appointments, medications and documents.`);
  });

  test("only this profile's records: never another account's, nor another profile's", async () => {
    const mine = await answer("headache");
    assert.ok(mine.records.every((r) => !/OTHER PERSON|Sami/.test(r.detail)));
    const sami = await answerHistoryQuestion({ owner: me._id, profileId: child._id, question: "headache", now: NOW });
    assert.deepEqual(sami.records.map((r) => r.detail), ["Sami has a headache and fever"]);
    const stranger = await answerHistoryQuestion({ owner: other._id, profileId: child._id, question: "headache", now: NOW });
    assert.deepEqual(stranger.records, []);
  });

  test("with AI: the model writes the answer from the found records, citing them", async () => {
    const calls = [];
    const client = { complete: async (messages) => { calls.push(messages); const { records } = JSON.parse(messages[1].content); return JSON.stringify({ answer: "Your most recent headache check was on 3 October 2026.", sources: [records[0].id] }); } };
    const result = await answer("When did I last have a headache?", { aiClient: client });
    assert.equal(result.answeredBy, "ai");
    assert.equal(result.answer, "Your most recent headache check was on 3 October 2026.");
    assert.deepEqual(result.sources, [result.records[0].id]);
    const sent = JSON.parse(calls[0][1].content);
    assert.deepEqual(Object.keys(sent).sort(), ["period", "question", "records", "today"]);
    assert.equal(sent.records.length, 2);
    assert.ok(!JSON.stringify(sent).includes("OTHER PERSON"), "only the matching records of this profile are sent");
    assert.match(calls[0][0].content, /never instructions/);
  });

  test("with AI failing or answering badly, the plain answer is used and the reason kept", async () => {
    const down = { complete: async () => { throw new LlmError("timeout"); } };
    const slow = await answer("When did I last have a headache?", { aiClient: down });
    assert.equal(slow.answeredBy, "search");
    assert.equal(slow.aiReason, "timeout");
    assert.match(slow.answer, /^The most recent one/);
    const inventive = { complete: async () => JSON.stringify({ answer: "You had a migraine on 1 May.", sources: ["made-up"] }) };
    assert.equal((await answer("headache", { aiClient: inventive })).aiReason, "unknown_source");
    // Nothing found: the model isn't asked at all.
    let asked = false;
    await answer("nosebleed", { aiClient: { complete: async () => { asked = true; return "{}"; } } });
    assert.equal(asked, false);
    // A bug is not hidden as an AI failure.
    await assert.rejects(answer("headache", { aiClient: { complete: async () => { throw new TypeError("bug"); } } }), TypeError);
  });
});

// ---------------------------------------------------------------------------------------------
describe("POST /api/history/ask over HTTP", () => {
  const provider = { content: "", calls: 0 };
  let mongo, server, fakeProvider, base, user, cookie;
  before(async () => {
    Object.assign(process.env, { NODE_ENV: "test", APP_ENV: "test", CLIENT_ORIGIN: "http://localhost:3000", JWT_SECRET: crypto.randomBytes(32).toString("hex") });
    mongo = await createTestMongo();
    process.env.MONGO_URI = mongo.getUri();
    await mongoose.connect(process.env.MONGO_URI);
    const User = require("../src/models/User");
    const SymptomRecord = require("../src/models/SymptomRecord");
    user = await User.create({ name: "Http", email: `http-${Date.now()}@example.test`, passwordHash: "x" });
    cookie = `accessToken=${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "15m" })}`;
    await SymptomRecord.create({ owner: user._id, profileId: user._id, description: "PRIVATE-WORDS headache since lunch", urgencyResult: { level: "routine" } });
    fakeProvider = http.createServer((req, res) => {
      req.resume();
      req.on("end", () => { provider.calls += 1; res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: provider.content } }] })); });
    });
    await new Promise((resolve) => fakeProvider.listen(0, "127.0.0.1", resolve));
    server = require("../src/app").createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/history/ask`;
  }, { timeout: 240000 });
  after(async () => {
    for (const key of ["LLM_API_URL", "LLM_MODEL"]) delete process.env[key];
    for (const running of [server, fakeProvider]) if (running) await new Promise((resolve) => running.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });
  beforeEach(() => {
    Object.assign(process.env, { LLM_API_URL: `http://127.0.0.1:${fakeProvider.address().port}/v1`, LLM_MODEL: "fake" });
    provider.calls = 0;
  });
  const post = (body, who = cookie) => fetch(base, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.CLIENT_ORIGIN, ...(who ? { Cookie: who } : {}) }, body: JSON.stringify(body),
  }).then(async (response) => ({ status: response.status, body: await response.json() }));

  test("needs sign-in and a question of 3 to 300 characters", async () => {
    assert.equal((await post({ question: "headache" }, null)).status, 401);
    for (const question of [undefined, "hi", "x".repeat(301), 42]) assert.equal((await post({ question })).status, 400);
    assert.equal((await post({ question: "headache", useAi: "yes" })).status, 400);
    assert.equal((await post({ question: "headache", timeZone: 3 })).status, 400);
  });

  test("without consent the AI is never called", async () => {
    const res = await post({ question: "When did I last have a headache?", timeZone: "Asia/Beirut" });
    assert.equal(res.status, 200);
    assert.equal(res.body.answeredBy, "search");
    assert.equal(res.body.records.length, 1);
    assert.equal(provider.calls, 0);
  });

  test("with consent the AI answers, and only counts and codes are logged", async () => {
    const id = (await post({ question: "headache" })).body.records[0].id;
    provider.content = JSON.stringify({ answer: "Your last headache check was today.", sources: [id] });
    const lines = [];
    const write = process.stdout.write;
    process.stdout.write = function (chunk, ...rest) { lines.push(String(chunk)); return write.call(this, chunk, ...rest); };
    let res;
    try { res = await post({ question: "When did I last have a headache? PRIVATE-QUESTION", useAi: true }); } finally { process.stdout.write = write; }
    assert.equal(res.body.answeredBy, "ai");
    assert.equal(res.body.answer, "Your last headache check was today.");
    assert.equal(provider.calls, 1);
    const log = lines.join("");
    assert.match(log, /"event":"history_question".*"reason":"ai:1"/);
    assert.doesNotMatch(log, /PRIVATE-WORDS|PRIVATE-QUESTION|headache/);
  });

  test("an emergency described now comes with the call-140 safety message", async () => {
    const res = await post({ question: "I have crushing chest pain right now, did I have this before?" });
    assert.equal(res.status, 200);
    assert.equal(res.body.safety.phone, "140");
    assert.equal((await post({ question: "when did I last have chest pain?" })).body.safety, undefined);
  });
});
