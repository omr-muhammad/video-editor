import express from "express";
import { serverIndex } from "./middleware/index.js";
import * as User from "./controllers/user.js";
import * as Video from "./controllers/video.js";

import path from "node:path";
import cookieParser from "cookie-parser";

const PORT = 8000;

const app = express();

// ------ Middlewares ------ //

// For serving static files
app.use(express.static("public"));

// For parsing JSON body
app.use(express.json());

// For different routes that need the index.html file
app.use(serverIndex);

app.use(cookieParser());

// ------ API Routes ------ //
app.post("/api/login", User.logUserIn);

app.delete("/api/logout", User.protect, User.logUserOut);

app
  // .use()
  .route("/api/user")
  .get(User.protect, User.sendUserInfo)
  .put(User.protect, User.updateUser);

app.get("/api/videos", User.protect, Video.getVideos);
app.post("/api/upload-video", User.protect, Video.uploadVideo);

app.all("{*splat}", (req, res, next) => {
  return res
    .status(404)
    .json({ error: `${req.originalUrl} is not found on the server` });
});
// Handle all the errors that could happen in the routes
app.use((error, req, res) => {
  if (error && error.status) {
    res.status(error.status).json({ error: error.message });
  } else {
    console.error(error);
    res.status(500).json({
      error: "Sorry, something unexpected happened from our side.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server has started on port ${PORT}`);
});
