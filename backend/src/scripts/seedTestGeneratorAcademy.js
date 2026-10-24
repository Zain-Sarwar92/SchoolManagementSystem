import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Academy from "../models/Academy.js";
import User from "../models/User.js";
import { slugify } from "../utils/helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoSrc = path.resolve(
  __dirname,
  "../../uploads/academy-logos/testforge-logo.jpg"
);
const logoDestName = "testforge-logo.jpg";
const logoPublicPath = `/uploads/academy-logos/${logoDestName}`;

const ACADEMY = {
  name: "TestForge Academy",
  email: "test@generator.com",
  phone: "",
  address: "Test Generator product tenant",
  plan: "pro",
  logo: logoPublicPath,
  status: "active",
  moduleAcademyManagement: false,
  moduleTestGenerator: true,
};

const ADMIN = {
  name: "TestForge Admin",
  email: "test@generator.com",
  password: "TestGen@123",
  role: "academy_admin",
};

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing");

  if (!fs.existsSync(logoSrc)) {
    throw new Error(`Logo not found at ${logoSrc}`);
  }

  await mongoose.connect(uri);
  console.log("Connected:", uri);

  // Legacy academies: keep both products on if fields were never set
  const legacy = await Academy.updateMany(
    {
      $or: [
        { moduleAcademyManagement: { $exists: false } },
        { moduleTestGenerator: { $exists: false } },
      ],
    },
    {
      $set: {
        moduleAcademyManagement: true,
        moduleTestGenerator: true,
      },
    }
  );
  if (legacy.modifiedCount) {
    console.log(`Backfilled modules on ${legacy.modifiedCount} academies`);
  }

  let academy = await Academy.findOne({
    $or: [{ email: ACADEMY.email }, { slug: slugify(ACADEMY.name) }],
  });

  if (academy) {
    academy.name = ACADEMY.name;
    academy.email = ACADEMY.email;
    academy.logo = ACADEMY.logo;
    academy.plan = ACADEMY.plan;
    academy.status = "active";
    academy.moduleAcademyManagement = false;
    academy.moduleTestGenerator = true;
    academy.address = ACADEMY.address;
    await academy.save();
    console.log("Updated academy:", academy.name, academy._id.toString());
  } else {
    academy = await Academy.create({
      ...ACADEMY,
      slug: slugify(ACADEMY.name),
    });
    console.log("Created academy:", academy.name, academy._id.toString());
  }

  let admin = await User.findOne({ email: ADMIN.email });
  if (admin) {
    admin.name = ADMIN.name;
    admin.password = ADMIN.password;
    admin.role = "academy_admin";
    admin.academy = academy._id;
    admin.isActive = true;
    await admin.save();
    console.log("Updated admin:", admin.email);
  } else {
    admin = await User.create({
      ...ADMIN,
      academy: academy._id,
    });
    console.log("Created admin:", admin.email);
  }

  console.log("\nLogin:");
  console.log("  email:", ADMIN.email);
  console.log("  password:", ADMIN.password);
  console.log("  modules: Test Generator only");
  console.log("  logo:", ACADEMY.logo);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
