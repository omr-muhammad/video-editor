import { User } from "../db/models/user.js";
import { createSendToken } from "../utils/auth.js";
import jwt from "jsonwebtoken";

export async function protect(req, res, next) {
  const token = req.cookies.auth;

  if (!token)
    return next({
      status: 401,
      message: `UNAUTHORIZED: token is invalid please login.`,
    });

  try {
    const decoded = jwt.verify(token, process.env.jwt_secret);

    const user = await User.findById(decoded.id).select("-password -__v");

    if (!user)
      return next({
        status: 401,
        message: `UN_AUTH: User belongs to this token is no longer exist.`,
      });

    if (decoded.tokenV < user.tokenVersion)
      return next({
        status: 401,
        message: "UN_AUTH: Token expired, please login again.",
      });

    req.user = user;
  } catch (err) {
    console.error(`PROTECT USER MIDDLEWARE ERR: `, err);

    return next({ status: 401, message: `UNAUTHORIZED.` });
  }

  next();
}

export async function logUserIn(req, res, next) {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user)
    return next({ status: 404, message: "User not found, signup instead." });

  if (!(await user.checkPasswordMatch(password)))
    return next({ status: 400, message: "Invalid credentials." });

  return createSendToken(user.toObject(), 200, res);
}

export function logUserOut(req, res, next) {
  res.cookie("auth", "logout", {
    expires: new Date(0),
    httpOnly: true,
    secure: true,
  });

  res.status(200).json({ message: "Logged out successfully!" });
}

export async function sendUserInfo(req, res, next) {
  const user = await User.findById(req.user.id).lean();

  if (!user)
    next({
      status: 404,
      success: false,
      message: `User with id: ${req.user.id} not found.`,
    });

  const { password, tokenVersion, __v, ...rest } = user;

  res.status(200).json({ success: true, user: rest });
}

export async function updateUser(req, res) {
  const { username, name, email } = req.body;

  // Grab the user object that is currently logged in
  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      $set: {
        ...(username ? { username } : {}),
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!user)
    next({ status: 404, message: `User with id: ${req.user.id} not found.` });

  const { password, tokenVersion, __v, ...rest } = user.toObject();

  res.status(200).json({ user: rest });
}

export async function updatePassword(req, res, next) {
  const { oldPassword, newPassword } = req.body;

  console.log("credentials: ", req.body);

  const user = await User.findById(req.user.id);

  if (!user)
    return next({ status: 404, success: false, message: "User not found." });

  if (!(await user.checkPasswordMatch(oldPassword)))
    return next({
      status: 401,
      success: false,
      message: "Failed to update: Invalid credentials.",
    });

  user.password = newPassword;
  await user.save(); // run the pre hook to hash password

  return createSendToken(user, 200, res);
}
