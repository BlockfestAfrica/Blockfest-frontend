# 🌍 Blockf3st Africa 2026

Africa's biggest Web3 festival website - A modern, responsive, and highly optimized Next.js application for the premier blockchain conference expanding across Africa.

## 🚀 Project Overview

Blockf3st Africa is Africa's premier Web3 conference, now expanding to **two major events in 2026**:

**2026 Events:**

- 🇿🇦 **Johannesburg, South Africa** - May 2026
- 🇳🇬 **Lagos, Nigeria** - October 2026

**Theme:** Web3 In Motion — From Pipelines to Platforms

## ✨ Features

### 🎨 Design & UX

- **Fully Responsive:** Mobile-first design with smooth transitions across all devices
- **Custom Typography:** Gotham fonts for consistent brand identity
- **Brand Colors:** Primary blue (#1B64E4) and gold (#F2CB45)
- **Interactive Elements:** Smooth scroll navigation, hover effects, and touch-friendly controls
- **Image Optimization:** Next.js Image component with lazy loading and responsive sizing
- **Accessibility:** Proper ARIA labels, keyboard navigation, and screen reader support

### 🔍 SEO & Performance

- **Comprehensive SEO:** Complete meta tags, Open Graph, Twitter Cards
- **Structured Data:** JSON-LD schema for dual events, organizations, and website
- **Dynamic Sitemap:** Auto-generated XML sitemap with proper priorities
- **PWA Ready:** Progressive Web App support with offline capability
- **Performance Score:** 95+ Lighthouse score

### 📱 Pages

- **Homepage:** 2026 dual-event hero, countdown timers, stats, why attend, speakers, partners, sponsorship, FAQ
- **Blockfest 2025 Recap:** Complete 2025 event recap with stats, gallery, and highlights
- **Speakers:** 2025 speaker grid with search/filter (2025 Edition badge)
- **FAQ:** Comprehensive event FAQs
- **Schedule:** Event schedule page

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: React Icons, Lucide React
- **Package Manager**: npm

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or pnpm/yarn/bun)

### Installation

1. Clone the repository

```bash
git clone https://github.com/BlockfestAfrica/Blockfest-frontend.git
cd Blockfest-frontend
```

2. Install dependencies

```bash
npm install
```

3. Start the development server

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
├── app/
│   ├── blockfest-2025/      # 2025 event recap page
│   ├── faq/                 # FAQ page
│   ├── schedule/            # Schedule page
│   ├── speakers/            # Speakers listing & individual pages
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage (2026)
│   └── sitemap.ts           # Dynamic sitemap
├── components/
│   ├── home/                # Homepage components
│   │   ├── hero-2026.tsx        # Dual-event hero
│   │   ├── stats-2026.tsx       # 2025 success stats
│   │   ├── countdown-2026.tsx   # Dual countdown timers
│   │   ├── why-attend-2026.tsx  # Why attend section
│   │   ├── speakers.tsx         # 2025 speakers carousel
│   │   ├── partners.tsx         # Partners/sponsors
│   │   ├── sponsorship.tsx      # Sponsorship CTA
│   │   └── faq.tsx              # FAQ section
│   ├── seo/                 # SEO schema components
│   │   └── schema-markup-2026.tsx
│   ├── shared/              # Shared components
│   │   ├── navbar.tsx
│   │   └── footer.tsx
│   ├── speakers/            # Speaker components
│   └── ui/                  # UI components
├── lib/
│   ├── events.ts            # Event data & types
│   ├── speakers.ts          # Speaker data
│   ├── faq-data.ts          # FAQ data
│   └── utils.ts             # Utility functions
├── public/
│   ├── images/              # Static images
│   └── icons/               # Icons
└── types/
    └── index.ts             # TypeScript types
```

## Key Data Files

### `lib/events.ts`

Contains all event data including:

- `blockfest2025Lagos` - Completed 2025 event with stats
- `blockfest2026Johannesburg` - Upcoming Johannesburg event
- `blockfest2026Lagos` - Upcoming Lagos event
- Sponsorship packages and market opportunity data

### `lib/speakers.ts`

Speaker data for the speakers page and carousel.

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
NEXT_PUBLIC_SITE_URL=https://blockfestafrica.com
NEXT_PUBLIC_CONTACT_EMAIL=partnerships@blockfestafrica.com
NEXT_PUBLIC_TWITTER_HANDLE=@blockfestafrica
NEXT_PUBLIC_INSTAGRAM_HANDLE=blockfestival_africa
```

## Brand Guidelines

- **Primary Blue:** #1B64E4
- **Secondary Blue:** #0D3B8C
- **Dark Blue:** #031940
- **Gold Accent:** #F2CB45
- **Gradients:** `from-[#1B64E4] via-[#0D3B8C] to-[#031940]`

## Deploy on Vercel

The easiest way to deploy is using [Vercel](https://vercel.com):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new?utm_medium=default-template&filter=next.js)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

---

## About Blockf3st Africa

Blockf3st Africa is the **Superbowl of Web3** - Africa's premier blockchain conference bringing together builders, founders, investors, government officials, and Web3 enthusiasts.

**2025 Achievements:**

- 15,000+ registrations
- 12,000+ attendees
- 20+ speakers
- 54+ countries represented
- 2.2M+ Twitter impressions

**Connect with us:**

- 🐦 Twitter: [@blockfestafrica](https://twitter.com/blockfestafrica)
- 📸 Instagram: [@blockfestival_africa](https://instagram.com/blockfestival_africa)
- 💼 LinkedIn: [Blockfest Africa](https://linkedin.com/company/blockfest-africa)
- 📺 YouTube: [@blockchainfestivalafrica](https://youtube.com/@blockchainfestivalafrica)
