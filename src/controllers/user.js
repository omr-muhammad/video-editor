import { db } from "../DB.js";
import { createSendToken } from "../utils/auth.js";
import jwt from "jsonwebtoken";

export function protect(req, res, next) {
  const token = req.cookies.auth;

  if (!token) return res.status(401).json({ error: "Unauthorized" });
  // throw new AppError(401, "Access denied, Please logged in to get access.");

  try {
    const decoded = jwt.verify(token, process.env.jwt_secret);

    dbupdate();
    const user = dbusers.find((u) => u.id === decoded.id);

    if (!user) return res.status(401).json({ error: "Unauthorized" });
    // throw new AppError(401, "User belongs to this token is no longer exist");

    req.user = user;
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

export function logUserIn(req, res, next) {
  const { username, password } = req.body;

  dbupdate();
  const user = dbusers.find((user) => user.username === username);

  if (!user || user.password !== password)
    return res.status(401).json({ message: "Invalid username or password." });

  return createSendToken(user, 200, res);
}

export function logUserOut(req, res, next) {
  res.cookie("auth", "logout", {
    expires: new Date(0),
    httpOnly: true,
    secure: true,
  });

  res.status(200).json({ message: "Logged out successfully!" });
}

export function sendUserInfo(req, res) {
  dbupdate();
  const user = dbusers.find((user) => user.id === req.userId);
  res.status(200).json({ username: user.username, name: user.name });
}

export function updateUser(req, res) {
  const username = req.body.username;
  const name = req.body.name;
  const password = req.body.password;

  // Grab the user object that is currently logged in
  dbupdate();
  const user = dbusers.find((user) => user.id === req.userId);

  user.username = username;
  user.name = name;

  // Only update the password if it is provided
  if (password) {
    user.password = password;
  }

  dbsave();

  res.status(200).json({
    username: user.username,
    name: user.name,
    password_status: password ? "updated" : "not updated",
  });
}
