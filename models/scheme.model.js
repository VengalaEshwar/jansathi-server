import mongoose from "mongoose";

const schemeSchema = new mongoose.Schema({
  id: String,
  name: String,
  short_title: String,
  description: String,
  category: [String],
  state: [String],
  tags: [String],
  level: String,
  slug: String,
});

schemeSchema.index({ name: "text", description: "text", tags: "text" });

const Scheme = mongoose.model("Scheme", schemeSchema, "schemes");

export default Scheme;