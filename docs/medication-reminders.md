# Custom medication reminders

On **Medications**, add or edit a medication and choose **Add reminder time**. Set up to 12 distinct daily times and a time zone (initially the browser's zone). Saving applies only to that medication and the selected profile. The list displays its saved times and zone; editing reloads them. Remove every time to disable that medication's reminders.

These are in-app reminders in the notification bell and Notifications page. They do not send SMS, email, push notifications or device alarms. Users can mute the **Medication reminders** notification type in their profile without affecting appointment or safety alerts. Medication names, doses and notes are excluded from reminder notifications.

The backend checks due reminders every minute, including while the medication page is closed. Schedules use local wall-clock times in the saved IANA time zone, not the server's zone, and do not move when the user travels. A nonexistent time during a spring daylight-saving transition is skipped that day; an autumn repeated time generates one reminder. Times begin on the medication's start date and include its end date. Discontinuing or deleting stops future reminders; reactivating calculates the next future occurrence.

Notifications are deduplicated per medication and scheduled instant across concurrent workers and retries. After an outage, reminders more than five minutes late are skipped and the next occurrence is scheduled, so an old reminder does not prompt a late dose. A temporary notification write failure retains the due occurrence for retry. Reminder timing does not infer prescribed frequency or alter adherence check-ins.

The API accepts `reminderTimes` (an array of `HH:mm` strings) and `reminderTimeZone` in medication create/update requests. Duplicate, invalid or excessive times and invalid time zones return 400. Omitted reminder fields on an update preserve the saved settings for older clients. New medications without times and existing medications have reminders off. The scheduler cursor is internal; downloaded account data includes the selected times and zone. Existing account/profile access checks and deletion cleanup apply.

## Verification

- Backend tests cover persistence, independent schedules, editing/disabling, old clients, validation, profile isolation, time zones, midnight, start/end dates, daylight saving, concurrent delivery, privacy, preferences, discontinuation/reactivation, deletion, missed reminders and write-failure retries.
- Frontend tests cover adding, editing, reloading and removing times, independent medication settings, invalid/empty/duplicate times, invalid zones, failed saves and paused schedules.
- `test_custom_medication_reminder_times_persist_and_can_be_disabled` in the Selenium suite saves a reminder through the real UI, reloads it, edits it, removes it and reloads again before cleaning up the test medication.
- Manual acceptance: save two medications with different times; reload; edit only the first; verify the second is unchanged. At a scheduled time check the notification bell/history for one reminder. Discontinue the medication or remove all times and confirm no future reminders. Test linked profiles separately.

Local validation on 8 November 2026: all 921 backend tests and 619 frontend tests passed; the production build passed. After the final form adjustment, the 34 medication/notification frontend tests and production build passed again. A real Chromium session against a disposable MongoDB/API and the production frontend verified multiple saved times, reload/edit/remove, mobile width and one actual scheduled notification. The committed Selenium persistence/disable case also passed against that app. GitHub CI has not run for this change because the session's GitHub credential is invalid.
