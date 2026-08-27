import express from "express";
import * as User from "../controllers/user.js"

export const authRouter = express.Router();

authRouter.post("/login", User.logUserIn)
