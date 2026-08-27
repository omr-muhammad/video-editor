import express from "express";
import * as Video from "../controllers/video.js";
import * as User from "../controllers/user.js";

export const videosRouter = express.Router();

videosRouter.use(User.protect);

videosRouter
  .route("/")
    .get(Video.getVideos)
    .post(Video.uploadVideo)

videosRouter
    .get("/:videoId/asset", Video.getVideoAsset)
    .post("/:videoId/audio", Video.extractAudio)
    .post("/:videoId/resize", Video.resize)
