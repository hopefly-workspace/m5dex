# API Proxy Setup (This Project)

The app talks to the backend via **same-origin `/api`**. A proxy (in dev) or rewrite (in production) forwards `/api` to the real backend so the browser never hits the API directly — **no CORS**.

---

## How it works

| Environment | Request path (browser) | Who forwards | Backend URL |
|-------------|------------------------|--------------|-------------|
| **Dev**     | `http://localhost:5173/api/...` | Vite dev server proxy | `VITE_BACKEND_URL` or default |
| **Netlify** | `https://yoursite.com/api/...`   | Netlify redirect      | `netlify.toml` |
| **Vercel**  | `https://yoursite.com/api/...`   | Vercel rewrite        | `vercel.json` |
| **Nginx**   | `https://yoursite.com/api/...`   | Nginx `location /api/` | `docs/nginx-proxy.conf` |

Path rewrite: `/api/foo` → backend receives `/foo` (the `/api` prefix is stripped).

---

## 1. Development (Vite proxy)

**File:** `vite.config.js`

- Proxy is already set: `/api` → backend.
- Backend URL comes from env: `VITE_BACKEND_URL` or fallback `https://globaltradeapi.blockcryp.com/v1`.

**Optional – override backend in `.env`:**

```env
VITE_BACKEND_URL=https://globaltradeapi.blockcryp.com/v1
```

Restart dev server after changing `.env`:

```bash
npm run dev
```

---

## 2. Production – Netlify

**File:** `netlify.toml`

Redirect is already configured:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://globaltradeapi.blockcryp.com/v1/:splat"
  status = 200
  force = true
```

To use a different backend, change the `to` URL. `:splat` is the path after `/api/` (e.g. `/api/auth/login` → backend gets `/auth/login`).

---

## 3. Production – Vercel

**File:** `vercel.json`

Rewrite is already configured:

```json
"rewrites": [
  {
    "source": "/api/:path*",
    "destination": "https://globaltradeapi.blockcryp.com/v1/:path*"
  }
]
```

To use a different backend, change `destination`. `:path*` is the path after `/api/`.

---

## 4. Production – Nginx (self‑hosted / VPS)

**File:** `docs/nginx-proxy.conf`

Is project ke liye ready-made snippet hai. Apne Nginx `server { }` block ke andar include karein (e.g. `include /path/to/docs/nginx-proxy.conf;`) ya content copy karke `server` block ke andar paste karein.

**Important:**
- `proxy_pass https://globaltradeapi.blockcryp.com/v1/;` — trailing slash zaroori, taaki `/api/foo` → backend par `/foo` jaye (Nginx location `/api/` hata ke baki path append karta hai).
- `proxy_set_header Host globaltradeapi.blockcryp.com;` — backend ko sahi Host mile (virtual host / CORS ke liye).

**Backend change karna ho:** `proxy_pass` aur `proxy_set_header Host` dono mein naya host daalein.

Reload Nginx after edit: `sudo nginx -t && sudo systemctl reload nginx`

---

## 5. Frontend (no config needed)

- **Base URL:** `src/services/api.js` uses `API_BASE_URL = '/api'` (or `VITE_API_BASE_URL` from env).
- All API calls use relative paths (e.g. `/auth/login`, `/wallet/balance`). The client builds `'/api' + path` (e.g. `/api/auth/login`).
- Trading API (`tradingApi.js`) uses the same base, so it also goes through `/api`.

You don’t need to change frontend code when switching backend; only env (dev) or `netlify.toml` / `vercel.json` (prod).

---

## Quick reference

| Goal | Where to change |
|------|------------------|
| Dev: different backend | `.env` → `VITE_BACKEND_URL=...` then restart `npm run dev` |
| Prod (Netlify): different backend | `netlify.toml` → `to = "https://your-api.com/v1/:splat"` |
| Prod (Vercel): different backend | `vercel.json` → `destination": "https://your-api.com/v1/:path*"` |
| Prod (Nginx): different backend | `docs/nginx-proxy.conf` → `proxy_pass` + `proxy_set_header Host` update karein |
| Force a different base path in app | `.env` → `VITE_API_BASE_URL=/api` (default; only change if you use another prefix) |

---

## Troubleshooting

- **CORS in dev:** Ensure dev server was restarted after proxy/env changes. Requests must go to `http://localhost:5173/api/...`, not directly to the backend URL.
- **404 on /api in prod:** Check that the redirect (Netlify), rewrite (Vercel), or Nginx `location /api/` is correct and reloaded.
