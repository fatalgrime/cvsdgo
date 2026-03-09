# CVSD Go

CVSD Go is a modern, high-performance link redirection and discovery page.

## Features

- Green/slate glassmorphism dashboard UI with rounded cards and subtle shadows
- Hero search bar with real-time link filtering
- Link cards with short name, destination title, click count, and one-click copy
- Dynamic redirect endpoint at `/go/[slug]`
- Neon PostgreSQL integration via `redirects` table
- Click analytics via automatic `click_count` increments on redirect
- Custom branded 404 page for unknown shortcuts

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and set your Neon connection string:

```bash
cp .env.example .env.local
```

3. Create the `redirects` table and seed sample links:

```bash
# Run this against your Neon database
psql "$DATABASE_URL" -f schema.sql
```

4. Start development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Redirect Behavior

- Visiting `/go/enroll` looks up slug `enroll` in Neon.
- If found: increments `click_count` and returns a server-side `302` redirect.
- If missing: returns a custom `404 Link Not Found` page with a home button.
