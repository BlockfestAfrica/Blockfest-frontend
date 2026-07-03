# Blockf3st Africa

Website for Africa's biggest Web3 conference. Built with Next.js 15, TypeScript, and Tailwind CSS.

**2026 events:** South Africa / Cape Town (May) and Lagos (October).

Live at [blockfestafrica.com](https://blockfestafrica.com)

## Setup

```bash
git clone https://github.com/BlockfestAfrica/Blockfest-frontend.git
cd Blockfest-frontend
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Lint with ESLint |

## Project structure

```
app/
  page.tsx                  # Homepage (2026)
  blockfest-2025/           # 2025 recap
  speakers/                 # Speaker listing + [slug] pages
  schedule/                 # Event schedule
  faq/                      # FAQ
  getdp/                    # Badge generator

components/
  home/                     # Homepage sections (hero, stats, speakers, etc.)
  shared/                   # Navbar, footer
  speakers/                 # Speaker grid, cards
  seo/                      # JSON-LD schema markup
  ui/                       # Primitives (button, sheet, accordion)

lib/
  events.ts                 # Event data, sponsorship tiers, market stats
  speakers.ts               # Speaker list
  faq-data.ts               # FAQ content
  constants.ts              # Contact email, social URLs
  fonts.ts                  # Gotham font config
```

## Environment variables

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_SITE_URL=https://blockfestafrica.com
NEXT_PUBLIC_CONTACT_EMAIL=partnerships@blockfestafrica.com
```

## Deployment

Deployed on Vercel. Pushes to `main` trigger production deploys.

## Contributing

1. Fork the repo
2. Create a feature branch
3. Open a PR against `main`
