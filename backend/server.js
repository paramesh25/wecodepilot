require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const session = require("express-session");

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const MOODLE_URL = process.env.MOODLE_URL?.replace(/\/+$/, "");
const MOODLE_TOKEN = process.env.MOODLE_TOKEN;
const MOODLE_LOGIN_SERVICE = process.env.MOODLE_LOGIN_SERVICE;

for (const [name, value] of Object.entries({
  MOODLE_URL,
  MOODLE_TOKEN,
  MOODLE_LOGIN_SERVICE,
  SESSION_SECRET: process.env.SESSION_SECRET,
})) {
  if (!value) throw new Error(`${name} is missing. Copy backend/.env.example to backend/.env and fill it in.`);
}

const MOODLE_REST = `${MOODLE_URL}/webservice/rest/server.php`;
const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "20kb" }));

// NOTE: express-session's default MemoryStore is fine for development only.
// Sessions are lost on restart. Use Redis / a DB store before production.
app.use(
  session({
    name: "wch.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: IS_PROD, // requires HTTPS (and app.set("trust proxy", 1) behind a proxy) in production
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

/** Call a Moodle web-service function. Uses the integration token unless another is given. */
async function callMoodle(params, token = MOODLE_TOKEN) {
  const body = new URLSearchParams({ wstoken: token, moodlewsrestformat: "json", ...params });
  const { data } = await axios.post(MOODLE_REST, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });
  if (data?.exception || data?.errorcode || data?.error) {
    const err = new Error(data.message || data.error || "Moodle API request failed");
    err.moodleError = true;
    err.moodleCode = data.errorcode;
    throw err;
  }
  return data;
}

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const promisify = (fn) => new Promise((resolve, reject) => fn((e) => (e ? reject(e) : resolve())));

function requireLogin(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Please log in to continue." });
  next();
}

// ---------- Health / diagnostics ----------
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/moodle-test", async (req, res) => {
  try {
    const info = await callMoodle({ wsfunction: "core_webservice_get_site_info" });
    res.json({ ok: true, sitename: info.sitename, release: info.release });
  } catch (err) {
    console.error("Moodle test failed:", err.moodleCode || "", err.message);
    res.status(502).json({ ok: false, error: "Moodle connection failed.", ...(IS_PROD ? {} : { details: err.message, moodleCode: err.moodleCode || null }) });
  }
});

// ---------- Courses ----------
app.get("/api/courses", async (req, res) => {
  try {
    const data = await callMoodle({ wsfunction: "core_course_get_courses" });
    if (!Array.isArray(data)) return res.status(502).json({ error: "Unexpected Moodle course response." });
    res.json(
      data
        .filter((c) => c.id !== 1 && c.visible !== 0)
        .map((c) => ({ id: c.id, name: c.fullname, shortname: c.shortname, summary: c.summary }))
    );
  } catch (err) {
    console.error("Course request failed:", err.moodleCode || "", err.message);
    res.status(500).json({ error: "Could not load courses from Moodle." });
  }
});

// ---------- Enrolled course access ----------
// This endpoint never enrols a learner. It only checks their existing Moodle enrolments.
app.get("/api/courses/:id/access", requireLogin, async (req, res) => {
  const courseId = Number(req.params.id);
  if (!Number.isSafeInteger(courseId) || courseId < 1) {
    return res.status(400).json({ error: "Invalid course ID." });
  }

  try {
    const enrolledCourses = await callMoodle({
      wsfunction: "core_enrol_get_users_courses",
      userid: String(req.session.user.id),
    });

    if (!Array.isArray(enrolledCourses)) {
      return res.status(502).json({ error: "Moodle returned an unexpected enrolment response." });
    }

    const isEnrolled = enrolledCourses.some((course) => Number(course.id) === courseId);
    if (!isEnrolled) {
      return res.status(403).json({
        error: "You are not enrolled in this course. Course access is limited to existing enrolments.",
      });
    }

    // The URL is generated from the configured Moodle base URL and a validated numeric course ID.
    res.json({ courseUrl: `${MOODLE_URL}/course/view.php?id=${courseId}` });
  } catch (err) {
    console.error("Course access check failed:", err.moodleCode || "", err.message);
    res.status(502).json({
      error: "Could not verify your course enrolment with Moodle.",
      ...(IS_PROD ? {} : { details: err.message, moodleCode: err.moodleCode || null }),
    });
  }
});

// ---------- Register ----------
app.post("/api/register", async (req, res) => {
  const { firstname, lastname, email, password } = req.body || {};
  if (
    [firstname, lastname, email, password].some((v) => typeof v !== "string") ||
    !firstname.trim() ||
    !lastname.trim() ||
    !isValidEmail(email.trim()) ||
    password.length < 8 ||
    password.length > 128
  ) {
    return res.status(400).json({ error: "Enter your first name, last name, a valid email and a password of 8–128 characters." });
  }

  const cleanEmail = email.trim().toLowerCase();
  try {
    const result = await callMoodle({
      wsfunction: "core_user_create_users",
      "users[0][username]": cleanEmail,
      "users[0][password]": password,
      "users[0][firstname]": firstname.trim(),
      "users[0][lastname]": lastname.trim(),
      "users[0][email]": cleanEmail,
      "users[0][auth]": "manual",
    });
    if (!Array.isArray(result) || !result[0]?.id) {
      return res.status(502).json({ error: "Moodle did not confirm account creation." });
    }
    res.status(201).json({ message: "Account created. You can now log in.", user: { id: result[0].id, username: result[0].username } });
  } catch (err) {
    console.error("Registration failed:", err.moodleCode || "", err.message);
    const msg =
      err.moodleCode === "invalidparameter" || /already exists|duplicate/i.test(err.message)
        ? "An account with this email may already exist, or the password does not meet the site's password policy."
        : err.moodleError
          ? "Registration was rejected. Please check your details and try again."
          : "Could not create the account. Please try again.";
    res.status(err.moodleError ? 400 : 500).json({
      error: msg,
      ...(IS_PROD ? {} : { details: err.message, moodleCode: err.moodleCode || null }),
    });
  }
});

// ---------- Login ----------
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string" || !isValidEmail(email.trim()) || !password) {
    return res.status(400).json({ error: "Enter a valid email address and password." });
  }

  try {
    // 1. Moodle verifies the credentials and issues a user token.
    const { data: tokenData } = await axios.post(
      `${MOODLE_URL}/login/token.php`,
      new URLSearchParams({ username: email.trim().toLowerCase(), password, service: MOODLE_LOGIN_SERVICE }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 }
    );

    if (!tokenData?.token) {
      console.warn("Moodle refused login:", { errorcode: tokenData?.errorcode, error: tokenData?.error, service: MOODLE_LOGIN_SERVICE });
      return res.status(401).json({
        error: "Incorrect email or password.",
        // Development only: the real reason from Moodle, to make setup problems easy to spot.
        ...(IS_PROD ? {} : { details: tokenData?.error || null, moodleCode: tokenData?.errorcode || null }),
      });
    }

    // 2. Use the learner's own token once to read who they are. The token is NOT kept.
    const info = await callMoodle({ wsfunction: "core_webservice_get_site_info" }, tokenData.token);
    if (!info?.userid || info.username === "guest") {
      return res.status(401).json({ error: "Could not verify this account." });
    }

    // 3. Fresh session (prevents session fixation).
    await promisify((cb) => req.session.regenerate(cb));
    req.session.user = { id: info.userid, username: info.username, fullname: info.fullname, email: info.useremail };
    await promisify((cb) => req.session.save(cb));

    res.json({ user: req.session.user });
  } catch (err) {
    console.error("Login error:", { code: err.moodleCode || null, message: err.message, http: err.response?.status || null });
    const status = err.moodleError || err.response ? 502 : 500;
    res.status(status).json({
      error: err.moodleError
        ? "Signed in, but your learner service is missing a required function (core_webservice_get_site_info)."
        : "Could not reach the learning platform. Please try again.",
      ...(IS_PROD ? {} : { details: err.message, moodleCode: err.moodleCode || null }),
    });
  }
});

app.get("/api/me", requireLogin, (req, res) => res.json({ user: req.session.user }));

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Could not log out." });
    res.clearCookie("wch.sid");
    res.json({ message: "Logged out." });
  });
});

app.listen(PORT, () => console.log(`We Code Health backend → http://localhost:${PORT}  (CORS: ${FRONTEND_ORIGIN})`));
