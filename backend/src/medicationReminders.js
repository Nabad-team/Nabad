const Medication = require("./models/Medication");
const { notify } = require("./notifications");
const { nextReminder, localParts } = require("./medicationSchedule");
const { logEvent } = require("./logger");

// Late reminders beyond five minutes are skipped rather than prompting an old dose.
const GRACE_MS = 5 * 60000;
async function sendDueMedicationReminders(now = new Date()) {
  let sent = 0;
  const due = Medication.find({ status: "active", nextReminderAt: { $lte: now, $ne: null } }).sort({ nextReminderAt: 1 }).cursor();
  for await (const medication of due) {
    const filter = { _id: medication._id, status: "active", nextReminderAt: medication.nextReminderAt, updatedAt: medication.updatedAt };
    // A changed/deleted schedule must not be delivered from an old cursor snapshot.
    if (!await Medication.exists(filter)) continue;
    if (now - medication.nextReminderAt <= GRACE_MS) {
      const time = localParts(medication.nextReminderAt, medication.reminderTimeZone).time;
      const created = await notify(medication.owner, medication.profileId, "medication_reminder", {
        title: "Medication reminder",
        message: `A medication reminder is due at ${time} (${medication.reminderTimeZone}). Open your medication list for details.`,
        link: "/medications",
        dedupeKey: `medication:${medication._id}:${medication.nextReminderAt.toISOString()}`,
      });
      if (created) sent++;
    }
    await Medication.updateOne(filter, { $set: { nextReminderAt: nextReminder(medication, now) } }, { timestamps: false });
  }
  return sent;
}

function startMedicationReminderJob({ intervalMs = 60000 } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await sendDueMedicationReminders(); }
    catch (error) { logEvent("medication_reminders_failed", { errorType: error.name }); }
    finally { running = false; }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
module.exports = { sendDueMedicationReminders, startMedicationReminderJob, GRACE_MS };
