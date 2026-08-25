# Student Registry

A tiny static site (no build step) where students:
1. Sign up with **WhatsApp number + roll number + a password they choose**
2. Log back in with **roll number + password**
3. See, edit, or delete their own record (name, father's name, WhatsApp number, roll number)

It's plain HTML/CSS/JS talking directly to Supabase, so it can be hosted anywhere that serves static files (GitHub Pages, Netlify, Vercel, etc).

## 1. One required Supabase setting

The database table, security policies, and keys are already set up in your Supabase project (`cxyokrtwugwpxuddjodj`). There's one dashboard setting you need to flip yourself, because it isn't reachable through the API:

1. Go to your [Supabase dashboard](https://supabase.com/dashboard/project/cxyokrtwugwpxuddjodj/auth/providers) → **Authentication → Providers → Email**
2. Turn **OFF** "Confirm email"
3. Save

Why: the app signs students up with a hidden internal email (built from their roll number) so it can reuse Supabase's secure password auth under the hood — students never see or type an email. Without this setting, Supabase waits for an email confirmation that will never arrive, and sign-in won't work.

## 2. How data is protected

- Every student's row lives in a `profiles` table, one row per person.
- Row Level Security is on, with policies that only allow a logged-in user to `select` / `insert` / `update` / `delete` **their own row** (`auth.uid() = id`).
- Passwords are handled entirely by Supabase Auth — this app never sees or stores raw passwords.
- Note: "Delete my data" removes the profile row (name, father's name, WhatsApp number, roll number). It can't delete the underlying login account itself from the browser — that requires a server-side admin key, which isn't safe to ship in a static site. If you need full account deletion too, that has to run on a small backend or Supabase Edge Function with the service-role key.

## 3. Run it locally

Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## 4. Push to GitHub

I don't have a way to push to your GitHub account directly from here (no GitHub connector is set up in this workspace). To publish it yourself:

```bash
cd student-portal
git init
git add .
git commit -m "Student registry: signup, login, edit, delete"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Then, to host it for free on GitHub Pages: repo **Settings → Pages → Deploy from branch → main → / (root)**.

## Files

- `index.html` — the page (login/signup tabs + dashboard)
- `style.css` — styling
- `app.js` — all the logic (Supabase auth + CRUD)
- `config.js` — your Supabase project URL + public anon key (safe to expose; RLS does the real protecting)
