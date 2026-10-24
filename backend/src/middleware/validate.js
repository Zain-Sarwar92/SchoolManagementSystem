import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const formBool = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}, z.boolean());

export const createAcademySchema = z
  .object({
    name: z.string().min(2, "Academy name is required"),
    email: z.string().email("Valid academy email required"),
    phone: z.string().optional().default(""),
    address: z.string().optional().default(""),
    plan: z.enum(["free", "basic", "pro"]).optional().default("free"),
    adminName: z.string().min(2, "Admin name is required"),
    adminEmail: z.string().email("Valid admin email required"),
    adminPassword: z.string().min(6, "Admin password must be at least 6 characters"),
    logoUrl: z.string().optional().default(""),
    moduleAcademyManagement: formBool.optional().default(false),
    moduleTestGenerator: formBool.optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.moduleAcademyManagement && !data.moduleTestGenerator) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one product: Academy Management or Test Generator",
        path: ["moduleAcademyManagement"],
      });
    }
  });

export const updateAcademyStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export const createClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(80),
  description: z.string().max(300).optional().default(""),
});

export const updateClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(80),
  description: z.string().max(300).optional().default(""),
  isActive: z.boolean().optional(),
});

export const createStudentSchema = z.object({
  name: z.string().min(2, "Enter the student's full name").max(120),
  fatherName: z.string().min(2, "Enter the father's name").max(120),
  phone: z
    .string()
    .min(1, "Phone is required")
    .max(40)
    .refine((v) => v.replace(/\D/g, "").length >= 10, {
      message: "Phone must have at least 10 digits",
    }),
  guardianPhone: z
    .string()
    .max(40)
    .optional()
    .default("")
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, {
      message: "Guardian phone must have at least 10 digits",
    }),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .default("")
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Enter a valid email",
    }),
  gender: z.enum(["male", "female", "other"], { message: "Select gender" }),
  dateOfBirth: z.string().optional().default(""),
  cnicOrBForm: z.string().max(30).optional().default(""),
  address: z.string().min(5, "Address is required").max(400),
  admissionDate: z.string().min(1, "Admission date is required"),
  monthlyFee: z.coerce.number({ invalid_type_error: "Monthly fee is required" }).min(0),
  bloodGroup: z.string().max(10).optional().default(""),
  rollNumber: z.string().min(1, "Roll number is required").max(50),
  session: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((value) => !value || /^\d{4}-\d{4}$/.test(value), {
      message: "Session must look like 2025-2026",
    }),
  classId: z.string().min(1, "Please select a class"),
  sectionId: z.string().min(1, "Please select a section"),
  major: z.enum(["science", "arts"], { message: "Select major (Science or Arts)" }),
  group: z.string().min(1, "Please select a group"),
  customFields: z.record(z.string(), z.any()).optional().default({}),
  isActive: z.boolean().optional(),
  /** When true, collect Monthly Fee (and optional Admission) on create. */
  collectFeeOnAdd: z.boolean().optional().default(false),
  feePeriodKey: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || /^\d{4}-(0[1-9]|1[0-2])$/.test(v), {
      message: "Fee period must look like 2026-04",
    }),
  feeMethod: z
    .enum(["cash", "bank_transfer", "card", "other"])
    .optional()
    .default("cash"),
  feePaidAt: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Fee paid date must be YYYY-MM-DD",
    }),
  feeNote: z.string().max(500).optional().default(""),
  /** @deprecated Prefer collectFeeHeadIds */
  collectAdmissionFee: z.boolean().optional().default(false),
  /** Fee head ObjectIds to collect when collectFeeOnAdd is true */
  collectFeeHeadIds: z.array(z.string().min(1)).optional().default([]),
});

export const updateStudentSchema = createStudentSchema.omit({
  collectFeeOnAdd: true,
  feePeriodKey: true,
  feeMethod: true,
  feePaidAt: true,
  feeNote: true,
  collectAdmissionFee: true,
  collectFeeHeadIds: true,
});

export const promoteStudentSchema = z.object({
  session: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Session must look like 2027-2028"),
  classId: z.string().min(1, "Please select a class"),
  sectionId: z.string().min(1, "Please select a section"),
  group: z.string().min(1, "Please select a group"),
  rollNumber: z.string().min(1, "Roll number is required").max(50),
  monthlyFee: z.coerce.number().min(0).optional(),
});

export const createSectionSchema = z.object({
  name: z.string().min(1, "Section name is required").max(200),
  classId: z.string().min(1, "Please select a class"),
  capacity: z.preprocess((val) => {
    if (val === "" || val === undefined || val === null) return null;
    const num = Number(val);
    return Number.isNaN(num) ? val : num;
  }, z.number().int().min(1).nullable()),
  description: z.string().max(300).optional().default(""),
}).superRefine((data, ctx) => {
  // Create accepts comma-separated names; each part must be ≤40 (matches controller).
  const parts = String(data.name || "")
    .split(/[,/\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (part.length > 40) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Section name is too long (max 40): ${part}`,
        path: ["name"],
      });
    }
  }
});

export const updateSectionSchema = z.object({
  name: z.string().min(1, "Section name is required").max(40),
  classId: z.string().min(1, "Please select a class"),
  capacity: z.preprocess((val) => {
    if (val === "" || val === undefined || val === null) return null;
    const num = Number(val);
    return Number.isNaN(num) ? val : num;
  }, z.number().int().min(1).nullable()),
  description: z.string().max(300).optional().default(""),
  isActive: z.boolean().optional(),
});

const periodKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must look like 2026-04");

export const createFeeHeadSchema = z.object({
  name: z.string().trim().min(1, "Fee type name is required").max(100),
  category: z
    .enum(["tuition", "admission", "generator", "test", "lab", "transport", "other"])
    .optional()
    .default("other"),
  frequency: z.enum(["monthly", "one_time"]).optional().default("monthly"),
  description: z.string().max(500).optional().default(""),
  defaultAmount: z.preprocess((val) => {
    if (val === "" || val === undefined || val === null) return null;
    const num = Number(val);
    return Number.isNaN(num) ? val : num;
  }, z.number().min(0).nullable()),
  applicableMonths: z.array(z.number().int().min(1).max(12)).optional().default([]),
});

export const updateFeeHeadSchema = createFeeHeadSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const idListSchema = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((val) => {
    if (val == null || val === "") return [];
    if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
    return String(val)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  });

export const generateFeesSchema = z.object({
  session: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Session must look like 2026-2027"),
  periodKey: periodKeySchema,
  classId: z.string().optional().default(""),
  sectionId: z.string().optional().default(""),
  feeHeadId: z.string().optional().default(""),
  classIds: idListSchema,
  sectionIds: idListSchema,
  feeHeadIds: idListSchema,
  dueDate: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Due date must be YYYY-MM-DD",
    }),
});

export const collectFeeSchema = z.object({
  session: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Session must look like 2026-2027"),
  studentId: z.string().min(1, "Student is required"),
  method: z.enum(["cash", "bank_transfer", "card", "other"]).optional().default("cash"),
  paidAt: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Payment date must be YYYY-MM-DD",
    }),
  note: z.string().max(500).optional().default(""),
  items: z
    .array(
      z.object({
        chargeId: z.string().optional(),
        feeHeadId: z.string().optional(),
        periodKey: z.string().optional(),
        amount: z.coerce.number().positive("Amount must be positive"),
      })
    )
    .min(1, "Add at least one fee item"),
});

export const createExamSchema = z.object({
  name: z.string().trim().min(2, "Exam name is required").max(120),
  session: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || /^\d{4}-\d{4}$/.test(v), {
      message: "Session must look like 2026-2027",
    }),
  sectionIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one section"),
  sectionId: z.string().min(1).optional(),
  examDate: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Exam date must be YYYY-MM-DD",
    }),
  passPercent: z.coerce.number().min(1).max(100).optional().default(33),
});

export const updateExamSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  examDate: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => v == null || v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Exam date must be YYYY-MM-DD",
    }),
  passPercent: z.coerce.number().min(0).max(100).optional(),
});

export const addExamSubjectsSchema = z.object({
  subjectIds: z.array(z.string().min(1)).min(1, "Select at least one subject"),
  totalMarks: z.coerce.number().min(1).max(1000).optional().default(100),
});

export const saveMarksSchema = z.object({
  totalMarks: z.coerce.number().min(0.01).max(1000).optional(),
  studentMarks: z
    .array(
      z.object({
        studentId: z.string().min(1),
        obtained: z.union([z.string(), z.number(), z.null()]).optional(),
        absent: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
  manualMarks: z
    .array(
      z.object({
        _id: z.string().optional(),
        rollNumber: z.string().optional(),
        name: z.string().optional(),
        fatherName: z.string().optional(),
        obtained: z.union([z.string(), z.number(), z.null()]).optional(),
        absent: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
});

export const createTeacherSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  /* Optional for Test Generator sub-accounts; defaults to MATRIC */
  teacherLevel: z
    .enum(["PRIMARY", "MATRIC", "INTERMEDIATE"], {
      message: "Select a teacher type (Primary / Matric / Intermediate)",
    })
    .optional()
    .default("MATRIC"),
  assignments: z
    .array(
      z.object({
        classId: z.string().min(1),
        sectionId: z.string().min(1),
        subjectId: z.string().min(1),
      })
    )
    .optional()
    .default([]),
});

export const updateTeacherSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120).optional(),
  email: z.string().trim().email("Valid email required").optional(),
  password: z
    .union([
      z.literal(""),
      z.string().min(6, "Password must be at least 6 characters"),
    ])
    .optional(),
  teacherLevel: z.enum(["PRIMARY", "MATRIC", "INTERMEDIATE"]).optional(),
  isActive: z.boolean().optional(),
  assignments: z
    .array(
      z.object({
        classId: z.string().min(1),
        sectionId: z.string().min(1),
        subjectId: z.string().min(1),
      })
    )
    .optional(),
});

export const isSafeLogoUrl = (value = "") => {
  const url = value.trim();
  if (!url) return false;
  if (url.startsWith("//")) return false;

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (parsed.username || parsed.password) return false;
    if (/\.svg$/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
};

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(", ");
    const error = new Error(message);
    res.status(400);
    return next(error);
  }

  req.body = result.data;
  next();
};

export const requireAcademyLogo = (req, res, next) => {
  const logoUrl = String(req.body.logoUrl || "").trim();

  if (req.file) return next();

  if (logoUrl) {
    if (!isSafeLogoUrl(logoUrl)) {
      res.status(400);
      return next(new Error("Paste a valid http/https image URL (SVG not allowed)"));
    }
    req.body.logoUrl = logoUrl;
    return next();
  }

  res.status(400);
  return next(new Error("Academy logo required — upload a file or paste an image URL"));
};
