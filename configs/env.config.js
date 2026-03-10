import dotenv from "dotenv";
dotenv.config();

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET || "defaultsecret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
  // CLIENT_URL: process.env.CLIENT_URL || "http://localhost:8081",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  GMAIL_USER: process.env.GMAIL_USER,
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY,
  FCM_SERVER_KEY: process.env.FCM_SERVER_KEY,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
TWILIO_PHONE: process.env.TWILIO_PHONE,
TWILIO_VERIFIED_NUMBERS: process.env.TWILIO_VERIFIED_NUMBERS,
IS_PRODUCTION: process.env.NODE_ENV === "production",
};

export default env;