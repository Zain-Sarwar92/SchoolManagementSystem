import mongoose from "mongoose";

export const CUSTOM_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "email",
  "tel",
  "date",
  "time",
  "datetime-local",
  "url",
  "password",
  "select",
  "radio",
  "checkbox",
  "color",
  "range",
  "file",
];

const customFieldSchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: ["student"],
      default: "student",
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    type: {
      type: String,
      enum: CUSTOM_FIELD_TYPES,
      required: true,
    },
    options: {
      type: [String],
      default: [],
    },
    required: {
      type: Boolean,
      default: false,
    },
    placeholder: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    min: {
      type: Number,
      default: null,
    },
    max: {
      type: Number,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

customFieldSchema.index({ academy: 1, module: 1, key: 1 }, { unique: true });

export default mongoose.model("CustomField", customFieldSchema);
