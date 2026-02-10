const express = require("express");
const https = require("https");
const router = express.Router();
const { generateToken } = require("../middleware/auth");
const logger = require("../utils/logger");

// ---------------------------------------------------------------------------
// GitHub OAuth Configuration
// ---------------------------------------------------------------------------

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const GITHUB_CALLBACK_URL =
  process.env.GITHUB_CALLBACK_URL || "http://localhost:5173/auth/callback";

// Comma-separated list of GitHub usernames allowed to access the dashboard.
// If empty, any GitHub user can log in.
const GITHUB_ALLOWED_USERS = process.env.GITHUB_ALLOWED_USERS
  ? process.env.GITHUB_ALLOWED_USERS.split(",").map((u) => u.trim().toLowerCase())
  : [];

// ---------------------------------------------------------------------------
// Helper — make HTTPS requests to GitHub API (no external dependency)
// ---------------------------------------------------------------------------

function githubRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: options.method || "GET",
        headers: {
          "User-Agent": "ContestMonitor/1.0",
          Accept: "application/json",
          ...options.headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// GET /api/auth/github — redirect user to GitHub OAuth consent page
// ---------------------------------------------------------------------------

router.get("/github", (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: "GitHub OAuth not configured (GITHUB_CLIENT_ID missing)" });
  }

  const scope = "read:user user:email";
  const state = require("crypto").randomBytes(16).toString("hex");

  // Store state in a short-lived cookie to prevent CSRF
  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000, // 10 minutes
    sameSite: "lax",
  });

  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(GITHUB_CALLBACK_URL)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}`;

  res.json({ url });
});

// ---------------------------------------------------------------------------
// GET /api/auth/github/config — return client ID for frontend
// ---------------------------------------------------------------------------

router.get("/github/config", (_req, res) => {
  res.json({
    clientId: GITHUB_CLIENT_ID,
    configured: !!GITHUB_CLIENT_ID && !!GITHUB_CLIENT_SECRET,
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/github/callback — exchange code for token
// ---------------------------------------------------------------------------

router.post("/github/callback", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return res.status(500).json({ error: "GitHub OAuth not configured on server" });
    }

    // 1. Exchange code for access token
    const tokenResponse = await githubRequest(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      logger.warn("GitHub OAuth: failed to get access token", tokenResponse.data);
      return res.status(401).json({
        error: tokenResponse.data?.error_description || "Failed to authenticate with GitHub",
      });
    }

    // 2. Fetch user profile
    const userResponse = await githubRequest("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (userResponse.status !== 200) {
      return res.status(401).json({ error: "Failed to fetch GitHub user profile" });
    }

    const ghUser = userResponse.data;

    // 3. Check if user is in allowed list
    if (GITHUB_ALLOWED_USERS.length > 0) {
      if (!GITHUB_ALLOWED_USERS.includes(ghUser.login.toLowerCase())) {
        logger.warn(`GitHub OAuth: user '${ghUser.login}' not in allowed list`);
        return res.status(403).json({
          error: "Access denied. Your GitHub account is not authorized to access this dashboard.",
        });
      }
    }

    // 4. Fetch primary email (optional, for display)
    let email = ghUser.email;
    if (!email) {
      try {
        const emailResponse = await githubRequest("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (emailResponse.status === 200 && Array.isArray(emailResponse.data)) {
          const primary = emailResponse.data.find((e) => e.primary && e.verified);
          email = primary?.email || emailResponse.data[0]?.email || null;
        }
      } catch {
        // Email fetch is optional
      }
    }

    // 5. Generate JWT
    const token = generateToken({
      id: `github:${ghUser.id}`,
      username: ghUser.login,
      role: "admin",
      provider: "github",
      avatarUrl: ghUser.avatar_url,
      displayName: ghUser.name || ghUser.login,
      email,
    });

    logger.info(`GitHub OAuth: user '${ghUser.login}' authenticated successfully`);

    res.json({
      token,
      expiresIn: "12h",
      user: {
        id: ghUser.id,
        username: ghUser.login,
        displayName: ghUser.name || ghUser.login,
        avatarUrl: ghUser.avatar_url,
        email,
        provider: "github",
      },
    });
  } catch (err) {
    logger.error(`GitHub OAuth callback error: ${err.message}`);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me — return current user info from JWT
// ---------------------------------------------------------------------------

router.get("/me", (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const jwt = require("jsonwebtoken");
    const { JWT_SECRET } = require("../middleware/auth");
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);

    res.json({
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      provider: decoded.provider || "local",
      avatarUrl: decoded.avatarUrl || null,
      displayName: decoded.displayName || decoded.username,
      email: decoded.email || null,
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
