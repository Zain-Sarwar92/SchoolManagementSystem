# Free deploy guide (Atlas + Render + Vercel)

Neon DB mat use karo — yeh app **MongoDB** use karti hai.  
Free stack: **MongoDB Atlas** (DB) + **Render** (API) + **Vercel** (UI).

---

## Step 0 — PC pe tayyari

1. GitHub account banao / login: https://github.com  
2. Render account: https://render.com (GitHub se login)  
3. Vercel account: https://vercel.com (GitHub se login)  
4. MongoDB Atlas: https://www.mongodb.com/cloud/atlas  

Confirm locally:

- `backend/public/pts-media` folder maujood hai (paper images)  
- Backend chal raha ho: `cd backend && npm run dev`  
- Frontend: `cd frontend && npm run dev`  

---

## Step 1 — Code GitHub pe daalo

Is PC pe abhi `git remote` set nahi hai. Pehle repo banao:

1. GitHub → **New repository** → name e.g. `School_Management_system` → Create (empty, no README)  
2. Apne project folder mein PowerShell:

```powershell
cd C:\Users\zain4\Desktop\School_Management_system
git remote add origin https://github.com/YOUR_USERNAME/School_Management_system.git
git add -A
git status
```

**Zaroori:** `backend/public/pts-media` commit ho (warna live pe images tootengi).  
**Mat commit karo:** `.env`, passwords, `node_modules`.

3. Commit + push (jab tum ready ho):

```powershell
git commit -m "Prepare free deploy (Render + Vercel)"
git branch -M main
git push -u origin main
```

> `pts-media` ~100MB hai — pehla push slow ho sakta hai. Agar GitHub file-size error aaye to bata dena.

---

## Step 2 — MongoDB Atlas (free database)

1. Atlas → **Build a Database** → **M0 Free** → region choose (nearest) → Create  
2. **Database Access** → Add User → password save kar lo  
3. **Network Access** → Add IP → **Allow Access from Anywhere** (`0.0.0.0/0`) → Confirm  
4. **Database** → Connect → **Drivers** → copy connection string  

Example shape:

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/school_management?retryWrites=true&w=majority
```

`<password>` ko apna real password se replace karo.  
Database name: `school_management` (ya jo tum chaho).

---

## Step 3 — Render pe backend (API)

1. Render Dashboard → **New** → **Web Service**  
2. Connect GitHub repo `School_Management_system`  
3. Settings:

| Field | Value |
|--------|--------|
| Name | `sms-api` (kuch bhi) |
| Region | nearest |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance | **Free** |

4. **Environment** → Add:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | (Atlas connection string) |
| `JWT_SECRET` | (32+ random characters — password generator se) |
| `JWT_EXPIRES_IN` | `1d` |
| `CLIENT_URL` | `https://placeholder.vercel.app` (Step 4 ke baad sahi URL) |
| `SUPER_ADMIN_NAME` | `Super Admin` |
| `SUPER_ADMIN_EMAIL` | tumhara email |
| `SUPER_ADMIN_PASSWORD` | strong password (save locally) |
| `PTS_MEDIA_ROOT` | `/opt/render/project/src/public/pts-media` |
| `API_RATE_LIMIT` | `300` |

5. **Create Web Service** → wait until status **Live**  
6. Copy service URL, e.g. `https://sms-api-xxxx.onrender.com`  
7. Browser test: `https://sms-api-xxxx.onrender.com/api/health`  
   - Expect: `"mongo":"connected"`  

### Super Admin seed (ek dafa)

Render service → **Shell**:

```bash
npm run seed
```

Phir apna question bank seed/import (jo tum locally use karte ho).  
Bina bank ke paper generator empty rahega.

---

## Step 4 — Vercel pe frontend (UI)

1. Vercel → **Add New** → **Project** → GitHub repo select  
2. Configure:

| Field | Value |
|--------|--------|
| Framework Preset | Vite |
| Root Directory | `frontend` (Edit → select) |
| Build Command | `npm run build` |
| Output Directory | `dist` |

3. **Environment Variables**:

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://sms-api-xxxx.onrender.com/api` |

(Trailing slash mat lagana; end mein `/api` zaroori hai.)

4. **Deploy**  
5. Copy frontend URL: `https://something.vercel.app`  

---

## Step 5 — Dono ko connect karo

1. Render → Environment → `CLIENT_URL` = exact Vercel URL  
   Example: `https://something.vercel.app`  
   (https, no trailing slash)  
2. **Save** → service auto redeploy  
3. Open Vercel URL → login Super Admin (jo seed kiya)  

---

## Step 6 — Soft launch smoke test

1. Super Admin login OK  
2. **Register academy** → product: **Test Generator ON**, Academy Management **OFF**  
3. Academy admin se login  
4. Generator → paper banao → print  
5. Images/equations dikhne chahiye (`pts-media`)  
6. Academy **Suspend** → us account se login band  

---

## Problems / normal behavior

| Symptom | Matlab |
|---------|--------|
| Pehli API call 30–60s slow | Render **free sleep** — normal |
| CORS / login fail | `CLIENT_URL` ≠ Vercel URL |
| API 503 health | Atlas IP / `MONGO_URI` galat |
| Paper images missing | `pts-media` GitHub pe nahi / `PTS_MEDIA_ROOT` galat |
| Seed fail | `SUPER_ADMIN_EMAIL` + `PASSWORD` env missing / weak |

Sleep kam karne ke liye (optional): [UptimeRobot](https://uptimerobot.com) free → har 5–10 min  
`https://sms-api-xxxx.onrender.com/api/health` ping.

---

## Checklist

- [ ] GitHub push (`pts-media` included)  
- [ ] Atlas M0 + user + `0.0.0.0/0`  
- [ ] Render live + `/api/health` OK  
- [ ] `npm run seed` on Render  
- [ ] Question bank seeded  
- [ ] Vercel live + `VITE_API_URL` set  
- [ ] Render `CLIENT_URL` = Vercel URL  
- [ ] Super Admin login + TG-only academy + print test  

Done = free live soft launch.
