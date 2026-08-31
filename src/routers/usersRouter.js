import express from "express";
import * as User from "../controllers/user.js"

export const usersRouter = express.Router();

usersRouter.use(User.protect)
  .route("/me")
    .get(User.sendUserInfo)
    .patch(User.updateUser)


usersRouter
  .patch("/me/password", User.updatePassword)
  .post("/logout", User.logUserOut)
