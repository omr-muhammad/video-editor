import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "User must have a name."],
      minLength: [6, "Name must be more than 6 char."],
      maxLength: [20, "Name must be less than 20 char."],
      validate: {
        validator: function (name) {
          return /^[a-zA-Z_ ]+$/.test(name);
        },
        message: "Name can only conatin alphabit and _",
      },
    },
    role: {
      type: String,
      required: [true, "User must have a role."],
      enum: ["admin", "user"],
      default: "user",
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    username: {
      type: String,
      trim: true,
      unique: [true, "Username must be unique."],
      required: [true, "User must have a username."],
      minLength: [8, "Username must be more than 8 char."],
      maxLength: [20, "Username must be less than 20 char."],
    },
    email: {
      type: String,
      trim: true,
      unique: [true, "Email must be unique."],
      required: [true, "User must have an email."],
    },
    password: {
      type: String,
      trim: true,
      required: [true, "User must have a password."],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// --------- Middlewares ---------

// Hashing password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);

  // Upgrade token version to reject old login sessions
  if (!this.isNew) this.tokenVersion++;
});

// --------- Instance Methods ---------
userSchema.methods.checkPasswordMatch = async function (txtPassword) {
  return await bcrypt.compare(txtPassword, this.password);
};

export const User = mongoose.model("users", userSchema);
