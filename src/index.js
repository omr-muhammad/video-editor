import express from "express";
import { serverIndex } from "./middleware/index.js";
import * as User from "./controllers/user.js";
import * as Video from "./controllers/video.js";
import cookieParser from "cookie-parser";
import { connectMongoDB } from "./db/config.js";
import { usersRouter } from "./routers/usersRouter.js";
import { authRouter } from "./routers/authRouter.js";
import { videosRouter } from "./routers/videosRouter.js";

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
app
  .use("/api/auth", authRouter)
  .use("/api/users", usersRouter)
  .use("/api/videos", videosRouter)

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

connectMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server has started on port ${PORT}`);
  });
})
