import mongoose from "mongoose"

const SchemeSchema = new mongoose.Schema({
  name: String,
  short_title: String,
  description: String,
  category: [String],
  state: [String],
  tags: [String],
  level: String,
  slug: String
})

const Scheme = mongoose.model("Scheme", SchemeSchema)

export default Scheme