# We Code Health

Learning storefront for **We Code Health**, backed by a local **Moodle** (Docker Desktop).

```
React (Vite) :5173  →  Express API :3000  →  Moodle web services (Docker, :8000)
```

- `frontend/` – React 19 + Vite. Brand: navy, neon cyan → violet → magenta, phoenix mark.
- `backend/` – Node/Express proxy. Keeps the Moodle token secret, handles register, login and cookie sessions.
- There is **no separate database**; Moodle holds users and courses.

## Run locally

Prerequisites: Node 18+, Moodle running in Docker Desktop (e.g. http://localhost:8000).

```bash
# 1. backend
cd backend
cp .env.example .env      # fill in MOODLE_TOKEN, MOODLE_LOGIN_SERVICE, SESSION_SECRET
npm install
npm run dev               # http://localhost:3000   (check: /api/moodle-test)

# 2. frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

## Moodle configuration checklist

1. **Site admin → Advanced features:** enable web services.
2. **Server → Web services → Manage protocols:** enable **REST**.
3. **Integration service** ("Academy Integration", authorised users only) with functions:
   `core_webservice_get_site_info`, `core_course_get_courses`, `core_user_create_users`.
   Its token → `MOODLE_TOKEN`. The API user's role needs `webservice/rest:use`,
   `moodle/user:create` and course view capabilities.
4. **Learner login service** – a service whose **short name** goes in `MOODLE_LOGIN_SERVICE`:
   - enabled, **not** "authorised users only";
   - contains `core_webservice_get_site_info`;
   - learners' role must allow `moodle/webservice:createtoken` and `webservice/rest:use`.

## Troubleshooting login

In development (`NODE_ENV` not `production`) the login/register error box also shows Moodle's own
message, and the backend terminal prints the `errorcode`:

| errorcode | Meaning |
|---|---|
| `invalidlogin` | wrong password, or the Moodle *username* isn't the email |
| `servicenotavailable` | `MOODLE_LOGIN_SERVICE` isn't a valid service **short name**, or it's disabled |
| `nocaptoken` / "no permission to create a token" | learners lack `moodle/webservice:createtoken` |

## Roadmap

One-device-at-a-time sessions · enrolment / "My courses" · subscriptions & payments · persistent session store (Redis) before production.
