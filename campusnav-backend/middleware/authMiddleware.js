/**
 * Auth Middleware — JWT verification for faculty-only endpoints
 *
 * Usage: router.post("/protected", authMiddleware, handler)
 *
 * Attaches decoded payload to req.faculty = { id, facultyId, name }
 */

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "campusnav_jwt_secret_2026";

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            error: "Authentication required. Provide Bearer token."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.faculty = decoded; // { id, facultyId, name }
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: "Invalid or expired token."
        });
    }
}

module.exports = authMiddleware;
