const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // cek token ada atau tidak
    if (!authHeader) {
      return res.status(401).json({ message: "Token tidak ada" });
    }

    // format: Bearer TOKEN
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Token invalid" });
    }

    const decoded = jwt.verify(token, "SECRET_KEY");

    req.user = decoded; // simpan user ke request

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token tidak valid" });
  }
};