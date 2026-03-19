import User from "../models/user.model.js";
import transporter from "../configs/nodemailer.config.js";
import env from "../configs/env.config.js";
import crypto from "crypto";
import twilio from "twilio";

// ── Helpers ───────────────────────────────────────────────────────
const generateOtp = () => crypto.randomInt(100000, 999999).toString();
const otpExpiry = () => new Date(Date.now() + 10 * 60 * 1000);

// Add your Twilio verified trial numbers here (up to 5)
const TWILIO_VERIFIED_NUMBERS = env.TWILIO_VERIFIED_NUMBERS
  ? env.TWILIO_VERIFIED_NUMBERS.split(";").map((n) => n.trim())
  : [];

const normalizePhone = (phone) => {
  const cleaned = phone.replace(/\s/g, "").replace(/-/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  return `+91${cleaned}`;
};

// ── SMS — Twilio first, Fast2SMS fallback ─────────────────────────
export const sendReminderSms = async (phone, message) => {
  const normalizedPhone = normalizePhone(phone);
  const isTwilioVerified = TWILIO_VERIFIED_NUMBERS.includes(normalizedPhone);

  if (isTwilioVerified) {
    try {
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: message,
        from: env.TWILIO_PHONE,
        to: normalizedPhone,
      });
      console.log(`SMS sent via Twilio to ${normalizedPhone}`);
      return;
    } catch (e) {
      console.error("Twilio failed, falling back to Fast2SMS:", e.message);
    }
  }

  // Fast2SMS fallback (Quick route)
  try {
    const phoneWithoutCode = normalizedPhone.replace("+91", "");
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: env.FAST2SMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "rcs",
        message,
        language: "english",
        flash: 0,
        numbers: phoneWithoutCode,
      }),
    });
    const data = await response.json();
    if (!data.return) throw new Error(data.message || "Fast2SMS failed");
    console.log(`SMS sent via Fast2SMS to ${phoneWithoutCode}`);
  } catch (e) {
    console.error("Fast2SMS error:", e.message);
  }
};

// ── OTP SMS — Twilio first, Fast2SMS fallback ─────────────────────
const sendSmsOtp = async (phone, otp) => {
  const normalizedPhone = normalizePhone(phone);
  const isTwilioVerified = TWILIO_VERIFIED_NUMBERS.includes(normalizedPhone);
  const message = `Your JanSathi OTP is: ${otp}. Valid for 10 minutes. Do not share with anyone.`;

  if (isTwilioVerified) {
    try {
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: message,
        from: env.TWILIO_PHONE,
        to: normalizedPhone,
      });
      console.log(`OTP sent via Twilio to ${normalizedPhone}`);
      return { provider: "twilio" };
    } catch (e) {
      console.error("Twilio OTP failed, falling back:", e.message);
    }
  }

  // Fast2SMS fallback
  const phoneWithoutCode = normalizedPhone.replace("+91", "");
  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: env.FAST2SMS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "rcs",
      message,
      language: "english",
      flash: 0,
      numbers: phoneWithoutCode,
    }),
  });
  const data = await response.json();
  console.log("response from fast2SMS :\n",data);
  if (!data.return) throw new Error(data.message || "Fast2SMS failed");
  console.log(`OTP sent via Fast2SMS to ${phoneWithoutCode}`);
  return { provider: "fast2sms" };
};

// ── Send Phone OTP ────────────────────────────────────────────────
export const sendPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number required" });
    }

    // ── Production guard ──────────────────────────────────────
    if (env.IS_PRODUCTION) {
      const normalizedPhone = normalizePhone(phone);
      const isTwilioVerified = TWILIO_VERIFIED_NUMBERS.includes(normalizedPhone);
      if (!isTwilioVerified) {
        return res.status(403).json({
          success: false,
          smsDisabled: true,  // frontend checks this flag
          message: "SMS feature is currently unavailable for this number.",
        });
      }
    }

    const otp = generateOtp();
    const expiry = otpExpiry();

    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: { phoneOtp: otp, phoneOtpExpiry: expiry, phone } }
    );

    await sendSmsOtp(phone, otp);
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ── Verify Phone OTP ──────────────────────────────────────────────
export const verifyPhoneOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user.phoneOtp || !user.phoneOtpExpiry) {
      return res.status(400).json({ success: false, message: "No OTP found. Please request again." });
    }
    if (new Date() > user.phoneOtpExpiry) {
      return res.status(400).json({ success: false, message: "OTP expired. Please request again." });
    }
    if (user.phoneOtp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: { phoneVerified: true, phoneOtp: null, phoneOtpExpiry: null } }
    );

    res.json({ success: true, message: "Phone verified successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Send Email OTP ────────────────────────────────────────────────
export const sendEmailOtp = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    // Google users already verified
    if (user.isVerified) {
      await User.findOneAndUpdate(
        { uid: req.user.uid },
        { $set: { emailVerified: true } }
      );
      return res.json({ success: true, message: "Email already verified via Google" });
    }

    const otp = generateOtp();
    const expiry = otpExpiry();

    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: { emailOtp: otp, emailOtpExpiry: expiry } }
    );

    await transporter.sendMail({
      from: `JanSathi <${env.GMAIL_USER}>`,
      to: user.email,
      subject: "JanSathi - Email Verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0F172A; border-radius: 12px;">
          <h2 style="color: #8B5CF6; margin-bottom: 8px;">JanSathi</h2>
          <p style="color: #94A3B8;">Your email verification OTP is:</p>
          <div style="background: #1E293B; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #fff; letter-spacing: 8px; font-size: 36px;">${otp}</h1>
          </div>
          <p style="color: #94A3B8; font-size: 13px;">This OTP expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `,
    });

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Verify Email OTP ──────────────────────────────────────────────
export const verifyEmailOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user.emailOtp || !user.emailOtpExpiry) {
      return res.status(400).json({ success: false, message: "No OTP found. Please request again." });
    }
    if (new Date() > user.emailOtpExpiry) {
      return res.status(400).json({ success: false, message: "OTP expired. Please request again." });
    }
    if (user.emailOtp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: { emailVerified: true, emailOtp: null, emailOtpExpiry: null } }
    );

    res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Save FCM Token (kept for future use) ─────────────────────────
export const saveFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: { fcmToken } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Create Reminder ───────────────────────────────────────────────
export const createReminder = async (req, res) => {
  try {
    const {
      medicineName, dosage, times,
      startDate, endDate, isEveryday,
      notifyApp, notifySms, notifyEmail,
    } = req.body;

    const user = await User.findOne({ uid: req.user.uid });

    if (notifySms && !user.phoneVerified) {
      return res.status(400).json({ success: false, message: "Please verify your phone number first" });
    }
    if (notifyEmail && !user.emailVerified) {
      return res.status(400).json({ success: false, message: "Please verify your email first" });
    }

    await User.findOneAndUpdate(
      { uid: req.user.uid },
      {
        $push: {
          medicationReminders: {
            medicineName, dosage, times,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            isEveryday, notifyApp, notifySms, notifyEmail,
            isActive: true,
            createdAt: new Date(),
          },
        },
      }
    );

    const updated = await User.findOne({ uid: req.user.uid });
    res.json({ success: true, reminders: updated.medicationReminders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get Reminders ─────────────────────────────────────────────────
export const getReminders = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    res.json({ success: true, reminders: user.medicationReminders || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Update Reminder ───────────────────────────────────────────────
export const updateReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await User.findOne({ uid: req.user.uid });
    if (updates.notifySms && !user.phoneVerified) {
      return res.status(400).json({ success: false, message: "Please verify your phone number first" });
    }
    if (updates.notifyEmail && !user.emailVerified) {
      return res.status(400).json({ success: false, message: "Please verify your email first" });
    }

    const updateFields = {};
    Object.keys(updates).forEach((key) => {
      updateFields[`medicationReminders.$.${key}`] = updates[key];
    });

    await User.findOneAndUpdate(
      { uid: req.user.uid, "medicationReminders._id": id },
      { $set: updateFields }
    );

    const updated = await User.findOne({ uid: req.user.uid });
    res.json({ success: true, reminders: updated.medicationReminders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Delete Reminder ───────────────────────────────────────────────
export const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $pull: { medicationReminders: { _id: id } } }
    );
    const updated = await User.findOne({ uid: req.user.uid });
    res.json({ success: true, reminders: updated.medicationReminders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkSmsAvailability = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone required" });
    }

    // In dev — always available
    if (!env.IS_PRODUCTION) {
      return res.json({ success: true, available: true });
    }

    const normalizedPhone = normalizePhone(phone);
    const available = TWILIO_VERIFIED_NUMBERS.includes(normalizedPhone);

    res.json({ success: true, available });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};