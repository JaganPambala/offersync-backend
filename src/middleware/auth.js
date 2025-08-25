const jwt = require('jsonwebtoken');
const config = require("config");

function authMiddleware(req, res, next) {
    const token = req.header('Authorization')?.split(" ")[1]; 
    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    try {
        const decoded = jwt.verify(token, config.get("jwtSecret"));
        console.log("decoded---------",decoded);
        console.log(decoded);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ error: err.message || "Invalid token." });
        console.log("Invalid token:", err.message);
    }
}

module.exports = authMiddleware;
