// Controllers
import * as User from "./controllers/user.js";
import { Router } from "express";

export const userRouter = Router();

userRouter
  .post("/api/login", User.logUserIn)
  .delete("/api/logout", User.protect, User.logUserOut);

userRouter.use(User.protect);

userRouter.route("/api/user").get(User.sendUserInfo).put(User.updateUser);
