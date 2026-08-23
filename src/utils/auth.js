import jwt from "jsonwebtoken";

function createJWToken(id, tokenV) {
  return jwt.sign({ id, tokenV }, process.env.jwt_secret, {
    expiresIn: process.env.jwt_exp,
  });
}

export function createSendToken(user, stsCode, res, rememberMe = false) {
  const token = createJWToken(user.id, user.tokenVersion);

  const daysNum = rememberMe ? 1 : parseInt(process.env.jwt_exp);
  const duration = daysNum * 24 * 60 * 60 * 1000;
  const cookieOptions = {
    expires: new Date(Date.now() + duration),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  };

  res.cookie("auth", token, cookieOptions);

  return res.status(stsCode).json({ message: "successful request." });
}
