import jwt from "jsonwebtoken";

const JWT_EXP = "3d";

function createJWToken(id) {
  return jwt.sign({ id }, process.env.jwt_secret, {
    expiresIn: JWT_EXP,
  });
}

export function createSendToken(user, stsCode, res, rememberMe = false) {
  const token = createJWToken(user.id);

  const threeDays = parseInt(JWT_EXP) * 24 * 60 * 60 * 1000;
  const cookieOptions = {
    expires: new Date(Date.now() + threeDays),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  };

  res.cookie("auth", token, cookieOptions);

  // console.log("TOKEN CREATED: ", token);
  // console.log("USER: ", user);

  return res.status(stsCode).json({ message: "successful request." });
}
