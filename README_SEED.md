Seed users script

This repository includes a small helper to create multiple users via the admin API endpoint.

Prerequisites

- The backend server must be running (defaults to http://localhost:3000). Run:

```bash
npm run dev
```

- `tsx` is included in devDependencies and will run the TypeScript script without a build step.

Run the script

```bash
# Optionally set API base if your server runs somewhere else
API_BASE=http://localhost:3000 tsx scripts/seed-users.ts
```

Notes

- The script sends POST requests to `/api/admin/users` for each user. It sends an `adminUsername` field (`ณัฐวัตร` by default). If that admin user doesn't exist yet, create it first in the database or change `ADMIN_USERNAME` at the top of `scripts/seed-users.ts` to an existing admin.
- Passwords are set to `1234` for convenience — change them as appropriate.
