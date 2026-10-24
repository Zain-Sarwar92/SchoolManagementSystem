import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

await mongoose.connect(process.env.MONGO_URI);
const admins = await User.find({
  role: "academy_admin",
  email: /generator/i,
})
  .select("name email academy")
  .populate("academy", "name email")
  .lean();

for (const u of admins) {
  console.log(
    u.email,
    "|",
    u.name,
    "|",
    u.academy?.name || "no-academy",
    "|",
    u.academy?._id?.toString() || "-"
  );
}

const exact = await User.findOne({
  email: { $in: ["test1@generator.com", "test@generator.com"] },
})
  .populate("academy", "name")
  .lean();
console.log("EXACT:", exact?.email, exact?.academy?.name);

await mongoose.disconnect();
