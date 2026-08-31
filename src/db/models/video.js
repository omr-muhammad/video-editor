import mongoose, { Types } from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    // Reference to user
    user: {
      type: Types.ObjectId,
      ref: "users",
      required: [true, "Video must belong to a user."],
    },
    // String
    name: {
      type: String,
      trim: true,
      required: [true, "Video must have a name."],
    },
    // Enum String
    extension: {
      type: String,
      trim: true,
      enum: ["mp4", "mov", "webm", "mkv", "avi"],
      required: [true, "Video must have an extension."],
    },
    // Object for width and height
    dimensions: {
      width: {
        type: Number,
        required: [true, "Video dimensions is required."],
      },
      height: {
        type: Number,
        required: [true, "Video dimensions is required."],
      },
    },
    // Object for Enum status and Enum codec
    audio: {
      status: {
        type: String,
        enum: {
          values: ["processing", "noaudio", "extracted"],
          message: "{VALUE} is not a valid audio status",
        },
      },
      codec: {
        type: String,
        trim: true,
        required: [
          function () {
            return this.audio.status === "extracted";
          },
          "Audio codec is required for extracted audios.",
        ],
        enum: {
          values: [
            "aac",
            "mp3",
            "opus",
            "vorbis",
            "flac",
            "alac",
            "pcm_s16le",
            "pcm_s24le",
            "pcm_s32le",
            "pcm_f32le",
            "ac3",
            "eac3",
            "dts",
            "wmav2",
            "wmapro",
            "amr_nb",
            "amr_wb",
            "mp2",
            "truehd",
          ],
          message: "{VALUE} is not supported.",
        },
      },
    },
    // Array for [widthxheight]: Enum status
    resizes: [
      {
        _id: false,
        dimensions: {
          type: String,
          trim: true,
          required: [true, "Dimensions is required for new size."],
          validate: {
            validator: function (dim) {
              return /^\d{1,4}[x]\d{1,4}$/.test(dim);
            },
            message: "Invalid dimension format e.g. 1200x800.",
          },
        },
        status: {
          type: String,
          trim: true,
          required: [true, "resizing status is required."],
          enum: {
            values: ["processing", "finished"],
            message: "{VALUE} is not a valid status.",
          },
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// --------- Hooks ---------
videoSchema.pre("save", function () {
  if (this.isNew) {
    this.audio ??= {};
    this.resizes ??= [];
  }
});

export const Video = mongoose.model("videos", videoSchema);
