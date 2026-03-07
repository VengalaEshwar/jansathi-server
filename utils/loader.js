import mongoose from "mongoose"
import Scheme from "../models/schemes.model.js"
import schemes from "../data/schemes.js" 

export default  async function importSchemes() {


  await Scheme.deleteMany()

  await Scheme.insertMany(schemes)

  console.log("Schemes imported successfully")

  process.exit()
}
