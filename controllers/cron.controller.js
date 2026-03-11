import User from "../models/user.model.js";
import transporter from "../configs/nodemailer.config.js";
import env from "../configs/env.config.js";
import { sendReminderSms } from "./reminder.controller.js";

// ── Send Grouped Email ────────────────────────────────────────────
const sendGroupedEmail = async (email, name, reminders, time) => {
  try {
    const medicineRows = reminders
      .map(
        (r) => `
        <tr>
          <td style="padding: 10px 16px; color: #A78BFA; font-size: 16px; font-weight: bold;">
            💊 ${r.medicineName}
          </td>
          <td style="padding: 10px 16px; color: #94A3B8;">
            ${r.dosage}
          </td>
        </tr>`
      )
      .join("");

    await transporter.sendMail({
      from: `JanSathi <${env.GMAIL_USER}>`,
      to: email,
      subject:
        reminders.length === 1
          ? `💊 Medicine Reminder - ${reminders[0].medicineName}`
          : `💊 Medicine Reminder - ${reminders.length} medicines at ${time}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #0F172A; border-radius: 12px;">
          <h2 style="color: #8B5CF6; margin-bottom: 4px;">JanSathi Medicine Reminder</h2>
          <p style="color: #94A3B8; margin-top: 0;">Hello ${name || "there"},</p>
          <p style="color: #CBD5E1;">It's <strong style="color:#fff;">${time}</strong> — time to take your medicine${reminders.length > 1 ? "s" : ""}:</p>
          <div style="background: #1E293B; border-radius: 8px; overflow: hidden; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #334155;">
                  <th style="padding: 10px 16px; color: #8B5CF6; text-align: left; font-size: 13px;">Medicine</th>
                  <th style="padding: 10px 16px; color: #8B5CF6; text-align: left; font-size: 13px;">Dosage</th>
                </tr>
              </thead>
              <tbody>
                ${medicineRows}
              </tbody>
            </table>
          </div>
          <p style="color: #64748B; font-size: 12px; margin-top: 16px;">
            This is an automated reminder from JanSathi. Please take your medicines on time.
          </p>
        </div>
      `,
    });
    console.log(`📧 Email sent to ${email}`);
  } catch (e) {
    console.error("Email error:", e.message);
  }
};

// ── Send Grouped SMS ──────────────────────────────────────────────
const sendGroupedSms = async (phone, name, reminders, time) => {
  try {
    let message;
    if (reminders.length === 1) {
      message = `JanSathi Reminder: Time to take ${reminders[0].medicineName} - ${reminders[0].dosage}`;
    } else {
      const list = reminders.map((r) => `${r.medicineName} (${r.dosage})`).join(", ");
      message = `JanSathi Reminder at ${time}: Take ${list}`;
    }
    await sendReminderSms(phone, message);
  } catch (e) {
    console.error("SMS group error:", e.message);
  }
};

// ── Check Reminders ───────────────────────────────────────────────
export const checkReminders = async (req, res) => {
  // ── Security guard — only Atlas or local dev can call this ────
  const secret = req.headers["x-cron-secret"];
  if (env.IS_PRODUCTION && secret !== env.CRON_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`\n=== CRON: ${currentTime} ===`);

    const users = await User.find({ "medicationReminders.isActive": true });
    let notificationsSent = 0;

    for (const user of users) {
      const matchedReminders = [];

      for (const reminder of user.medicationReminders) {
        if (!reminder.isActive) continue;

        const start = new Date(reminder.startDate);
        start.setHours(0, 0, 0, 0);
        if (today < start) continue;

        if (reminder.endDate) {
          const end = new Date(reminder.endDate);
          end.setHours(23, 59, 59, 999);
          if (today > end) continue;
        }

        const normalizedTimes = reminder.times.map((t) => {
          const [h, m] = t.split(":");
          return `${String(Number(h)).padStart(2, "0")}:${String(Number(m)).padStart(2, "0")}`;
        });

        if (!normalizedTimes.includes(currentTime)) continue;

        matchedReminders.push(reminder);
      }

      if (matchedReminders.length === 0) continue;

      console.log(`✅ ${user.email} — ${matchedReminders.length} reminder(s) at ${currentTime}`);
      console.log(`   Medicines: ${matchedReminders.map((r) => r.medicineName).join(", ")}`);

      const needsSms = matchedReminders.some((r) => r.notifySms) && user.phone && user.phoneVerified;
      const needsEmail = matchedReminders.some((r) => r.notifyEmail) && user.email && user.emailVerified;

      const smsReminders = matchedReminders.filter((r) => r.notifySms);
      const emailReminders = matchedReminders.filter((r) => r.notifyEmail);

      if (needsSms && smsReminders.length > 0) {
        console.log(`   📱 Sending SMS for ${smsReminders.length} medicine(s)...`);
        await sendGroupedSms(user.phone, user.name, smsReminders, currentTime);
        notificationsSent++;
      }

      if (needsEmail && emailReminders.length > 0) {
        console.log(`   📧 Sending Email for ${emailReminders.length} medicine(s)...`);
        await sendGroupedEmail(user.email, user.name, emailReminders, currentTime);
        notificationsSent++;
      }
    }

    res.json({
      success: true,
      currentTime,
      usersProcessed: users.length,
      notificationsSent,
    });
  } catch (error) {
    console.error("Cron error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Cleanup Expired Reminders ─────────────────────────────────────
export const cleanupReminders = async (req, res) => {
  // ── Security guard ────────────────────────────────────────────
  const secret = req.headers["x-cron-secret"];
  if (env.IS_PRODUCTION && secret !== env.CRON_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await User.updateMany(
      { "medicationReminders.endDate": { $lt: today } },
      { $set: { "medicationReminders.$[elem].isActive": false } },
      {
        arrayFilters: [
          { "elem.endDate": { $lt: today }, "elem.isActive": true },
        ],
      }
    );

    res.json({ success: true, message: "Cleanup done" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};