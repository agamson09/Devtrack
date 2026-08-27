const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { parse } = require("cookie");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const COOKIE_NAME = "devtrack_token";

function generateToken(payload, expiresIn) {
  const options = { expiresIn: expiresIn || JWT_EXPIRES_IN }
  return jwt.sign(payload, JWT_SECRET, options)
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function getAuthUser(req) {
  try {
    let token = null

    // Check Authorization header first
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }

    // Fallback to cookie
    if (!token) {
      const cookieHeader = req.headers.cookie || ""
      const cookies = parse(cookieHeader)
      token = cookies[COOKIE_NAME]
    }

    if (!token) {
      return null;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Extract tenantId and workspaceDbName from the authenticated user's JWT.
 * Returns { tenantId, workspaceDbName }.
 * workspaceDbName may be null if the JWT was issued before workspace selection.
 */
function getWorkspaceContext(user) {
  return {
    tenantId: user?.tenant_id || null,
    workspaceDbName: user?.workspaceDbName || null,
  };
}

module.exports = {
  generateToken,
  verifyToken,
  getAuthUser,
  hashPassword,
  comparePassword,
  COOKIE_NAME,
  getWorkspaceContext,
};
