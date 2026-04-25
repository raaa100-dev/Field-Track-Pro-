# FieldAxisHQ — Deploy to Render

## The Problem
Render is reading from your existing GitHub repo (`Field-Track-Pro`) which has
a different folder structure. Our new `package.json` needs to be at the **repo root**.

---

## Option A — Push our code to your GitHub repo (recommended)

1. **Download** the `FieldAxisHQ.zip` and unzip it locally
2. **Clone** your existing repo:
   ```bash
   git clone https://github.com/raaa100-dev/Field-Track-Pro-
   cd Field-Track-Pro-
   ```
3. **Replace everything** with our files:
   ```bash
   # Remove all existing files
   git rm -rf .
   
   # Copy our files into the repo root:
   # package.json  → repo root
   # server.js     → repo root
   # public/       → repo root/public/
   # supabase-schema.sql → repo root
   
   git add .
   git commit -m "Replace with FieldAxisHQ v2"
   git push origin main
   ```
4. **Render will auto-redeploy** — build should succeed now.

---

## Option B — Set Root Directory in Render

If your old repo has `package.json` in a `/src` subfolder:

1. Go to your Render service → **Settings**
2. Find **Root Directory** → set it to `src` (or wherever package.json is)
3. **But** this won't use our new code — only works if you also copy our files there.

---

## Option C — Create a fresh Render service from scratch

1. Push our unzipped files to a **new GitHub repo** (e.g. `fieldaxishq`)
2. In Render → **New Web Service** → connect the new repo
3. Settings:
   - **Build Command:** `npm install`  (or leave blank — no deps)
   - **Start Command:** `node server.js`
   - **Root Directory:** *(leave empty)*
   - **Node version:** 18+

---

## Environment Variables (required in Render → Environment)

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Your Supabase service_role key |
| `JWT_SECRET` | Any random string (e.g. `openssl rand -hex 32`) |
| `CLOUDINARY_CLOUD` | *(optional)* Cloudinary cloud name |
| `CLOUDINARY_KEY` | *(optional)* Cloudinary API key |
| `CLOUDINARY_SECRET` | *(optional)* Cloudinary API secret |
| `CLOUDINARY_PRESET` | *(optional)* Upload preset name |

---

## After Deploy

1. Run `supabase-schema.sql` in your Supabase **SQL Editor**
2. Create two Supabase Storage buckets:
   - `fieldtrack-photos` (public, 20MB max)
   - `fieldtrack-plans` (public, 50MB max)
3. Visit `https://your-app.onrender.com`
4. Click **⚙ Configure** → enter your Supabase URL + anon key → Save
5. Sign in with your Supabase user credentials

