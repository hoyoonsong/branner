# Branner

Admin platform for Branner Hall: attendance (geofenced check-in), resident profiles, and a π-shaped floor map.

Staff sign in with **Stanford Google** (`@stanford.edu` only). First admins come from `ADMIN_EMAILS`; everyone else waits for approval.

## Local

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
# unzip frosh photos into data/photos-src (or leave the default Downloads zip path)
npm run import:roster
npm run dev
```

Open http://localhost:5174. Until Google OAuth is filled in, `ALLOW_DEV_LOGIN=1` lets you request access with a `@stanford.edu` email.

## Railway + Stanford Google

The app is ready to deploy as one web service. Railway cannot create a Google OAuth client for you, and Google cannot see Railway until you paste the public URL into the OAuth client.

### 1. Google Cloud OAuth (Stanford Google)

Create this with a **personal Gmail** if your SUNet account cannot create OAuth apps in Stanford’s Workspace.

1. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials).
2. Create or pick a project (name it `Branner`).
3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `Branner`
   - Support email: your address
   - Authorized domains: `hoyoonsong.com`, `up.railway.app`
   - Scopes: `email`, `profile`, `openid`
   - Test users: every `@stanford.edu` address that should sign in while the app is in Testing
4. **Credentials → Create credentials → OAuth client ID → Web application**
   - Name: `Branner web`
   - Authorized JavaScript origins:
     - `http://localhost:5174`
     - `https://branner.hoyoonsong.com`
   - Authorized redirect URIs:
     - `http://localhost:5174/api/auth/google/callback`
     - `https://branner.hoyoonsong.com/api/auth/google/callback`
5. Copy the client ID and secret.

The app already sends `hd=stanford.edu` and rejects any email that is not `@stanford.edu`. That is the Stanford restriction — not official WebLogin/SAML.

### 2. Railway project

In the Railway project (currently `joyful-truth`):

1. Create a **GitHub repo** for this folder and add it as a service, or deploy with `npx @railway/cli up` after `railway link`.
2. Add a **volume** mounted at `/data` so the SQLite database, sessions, and photos survive redeploys.
3. Set these **service variables**:

| Variable | Value |
| --- | --- |
| `ADMIN_EMAILS` | `hoyoon@stanford.edu` (comma-separated SUNets to auto-approve) |
| `SESSION_SECRET` | output of `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud |
| `PUBLIC_URL` | `https://branner.hoyoonsong.com` |
| `ALLOW_DEV_LOGIN` | `0` |
| `DATA_DIR` | `/data` |
| `DATABASE_URL` | `file:/data/branner.db` |

Leave `GOOGLE_CALLBACK_URL` unset unless you need to override it. The server uses `$PUBLIC_URL/api/auth/google/callback` or `https://$RAILWAY_PUBLIC_DOMAIN/api/auth/google/callback`.

4. Generate a public domain on the service (**Settings → Networking → Generate domain**).
5. Put that exact `https://…/api/auth/google/callback` URL back into the Google OAuth client.
6. Redeploy. `/api/health` should show `"googleEnabled": true`.

Then open the Railway URL, click **Continue with Stanford Google**, and sign in with your SUNet account.
