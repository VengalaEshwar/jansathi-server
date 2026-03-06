import dotenv from "dotenv";

dotenv.config();

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  MONGO_URI: process.env.MONGO_URI,

  JWT_SECRET: process.env.JWT_SECRET || "defaultsecret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",

  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:8081"
};

export default env;