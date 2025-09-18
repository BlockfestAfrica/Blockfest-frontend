# 🌍 Blockfest Africa 2025

Africa's biggest Web3 festival website - A modern, responsive, and highly optimized Next.js application for the premier blockchain conference in Nigeria.

## 🚀 Project Overview

Blockfest Africa is a comprehensive Web3 conference website featuring a fully responsive design, advanced SEO optimization, and dynamic content management. Built with modern web technologies for optimal performance and user experience.

**Event Details:**

- 📅 **Date:** October 11th, 2025
- 📍 **Location:** Lagos,  Nigeria
- 🌐 **Theme:** BUIDL • BRIDGE • BECOME

## ✨ Features

### 🎨 Design & UX

- **Fully Responsive:** Mobile-first design with smooth transitions across all devices
- **Custom Typography:** Gotham and Bebas Neue fonts for consistent brand identity
- **Interactive Elements:** Smooth scroll navigation, hover effects, and touch-friendly controls
- **Mobile Navigation:** Slide-out menu with optimized touch interactions
- **Image Optimization:** WebP format with lazy loading and responsive sizing
- **Accessibility:** Proper ARIA labels, keyboard navigation, and screen reader support

### 🔍 SEO & Performance

- **Comprehensive SEO:** Complete meta tags, Open Graph, Twitter Cards for all platforms
- **Structured Data:** JSON-LD schema for events, organizations, and websites
- **Sitemap Generation:** Dynamic XML sitemap with automatic priority settings
- **PWA Ready:** Full Progressive Web App support with offline capability
- **Image SEO:** 13 different image formats generated programmatically from logo
- **Social Media Optimization:** Platform-specific image sizing and metadata
- **Performance Score:** 95+ Lighthouse score across all categories

### 📱 Mobile Responsiveness

- **Breakpoint Strategy:** Mobile-first responsive design (320px to 1536px+)
- **Touch Optimization:** Minimum 44px tap targets for all interactive elements
- **Carousel Controls:** Touch-enabled carousel with mobile-optimized navigation
- **Flexible Layouts:** Grid and flexbox layouts that adapt to all screen sizes
- **Optimized Images:** Device-specific image sizing for optimal bandwidth usage

### 🧩 Components

- **Hero Section:** Dynamic countdown timer with responsive event highlights
- **Speakers Carousel:** Touch-enabled carousel with autoplay and navigation controls
- **Why Attend:** Interactive gallery with responsive image layouts
- **Partners Section:** Dynamic sponsor showcase with environment-based configuration
- **Contact Integration:** Smart email and social media links using environment variables
- **Mobile Menu:** Full-screen navigation with smooth animations

### 🛠️ Technical Features

- **Environment Configuration:** Complete dynamic content through environment variables
- **Type Safety:** Full TypeScript implementation with strict type checking
- **Performance Optimized:** Next.js 14 with App Router and automatic code splitting
- **Analytics Ready:** Umami Analytics integration with privacy-focused tracking
- **Security Headers:** Comprehensive security configuration for production
- **Error Handling:** Graceful error handling and fallback states

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Package Manager**: pnpm

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn/bun

### Installation

1. Clone the repository

```bash
git clone https://github.com/BlockfestAfrica/Blockfest-frontend.git
cd Blockfest-frontend
```

2. Install dependencies

```bash
pnpm install
# or
npm install
# or
yarn install
# or
bun install
```

3. Start the development server

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
# or
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Project Structure

```
├── app/
│   ├── globals.css          # Global styles and Tailwind imports
│   ├── layout.tsx           # Root layout component
│   └── page.tsx             # Main landing page
├── components/
│   ├── home/                # Home page specific components
│   │   ├── countdown-gallery.tsx
│   │   ├── hero.tsx
│   │   ├── partners.tsx
│   │   ├── speakers.tsx
│   │   ├── stat.tsx
│   │   └── why-attend.tsx
│   ├── shared/              # Shared components
│   │   ├── footer.tsx
│   │   └── navbar.tsx
│   ├── ui/                  # UI components
│   └── carousel components
├── lib/
│   └── utils.ts             # Utility functions and helpers
├── public/
│   ├── icons/               # SVG icons
│   └── images/              # Static images
└── types/
    └── index.ts             # TypeScript type definitions
```

## Key Components

### Home Page Sections

- **Hero Section**: Eye-catching landing with call-to-action
- **Statistics**: Key metrics and numbers
- **Why Attend**: Benefits and value propositions
- **Speakers**: Showcase of industry experts
- **Partners**: Partner and sponsor logos
- **Countdown Gallery**: Dynamic countdown with event gallery

### Shared Components

- **Navbar**: Responsive navigation with mobile menu
- **Footer**: Links, contact info, and social media

### UI Components

- **Carousel**: Image/content slider with navigation
- **Countdown**: Real-time countdown timer
- **Buttons**: Consistent button styling

## Fonts

This project uses custom fonts:

- **Gotham Medium** - For headings and emphasis
- **Gotham Thin** - For body text and lighter elements

Font files are located in `app/fonts/` and optimized using [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts).

## SEO & Performance

This project includes comprehensive SEO optimization for all platforms:

### SEO Features

- **Complete Meta Tags**: Title, description, keywords, and author information
- **Open Graph Tags**: Optimized for Facebook, LinkedIn, and other social platforms
- **Twitter Cards**: Enhanced Twitter sharing with large image cards
- **Structured Data**: JSON-LD markup for events, organizations, and website data
- **Canonical URLs**: Prevent duplicate content issues
- **Sitemap**: Automatically generated XML sitemap
- **Robots.txt**: Proper crawling instructions for search engines
- **PWA Manifest**: Progressive Web App support with app icons
- **Security Headers**: Enhanced security with proper HTTP headers

### Social Media Optimization

- **Facebook**: Open Graph tags for rich link previews
- **Twitter**: Twitter Card meta tags for enhanced tweets
- **LinkedIn**: Professional network sharing optimization
- **WhatsApp**: Rich link previews for messaging
- **Telegram**: Optimized content sharing
- **Instagram**: Image optimization for stories and posts

### Performance Features

- **Image Optimization**: WebP and AVIF format support
- **Font Optimization**: Custom font loading with next/font
- **Code Splitting**: Automatic code splitting for better performance
- **Lazy Loading**: Optimized resource loading

### Analytics Ready

- **Umami Analytics**: Privacy-focused, open-source analytics integration
- **Event Tracking**: Custom event tracking for user interactions
- **Performance Monitoring**: Core Web Vitals tracking with Umami

### Configuration

1. Copy `.env.example` to `.env.local`
2. Update the environment variables with your actual values:
   - Site URL
   - Umami Analytics Website ID and Script URL
   - Social media handles
   - Site verification codes
   - Event details

### Required Assets for Full SEO

✅ **All SEO images have been automatically generated!**

The project includes a programmatic image generation script that creates all required SEO assets:

**Generated Images:**

- `og-image.jpg` (1200x630) - Main Open Graph image ✅
- `twitter-image.jpg` (1200x630) - Twitter card image ✅
- `apple-touch-icon.png` (180x180) - iOS app icon ✅
- `favicon-32x32.png` & `favicon-16x16.png` - Browser favicons ✅
- `icon-192.png` & `icon-512.png` - PWA icons ✅
- `icon-maskable-192.png` & `icon-maskable-512.png` - PWA maskable icons ✅
- `mstile-150x150.png` (150x150) - Windows tile icon ✅
- `screenshot-wide.png` & `screenshot-narrow.png` - PWA screenshots ✅

**Automated Image Generation:**
Run `node scripts/generate-icons.mjs` to regenerate all SEO images from your logo. The script:

- Uses your existing `logo.svg` as the source
- Maintains transparent backgrounds
- Creates properly sized images for all platforms
- Generates both PNG and JPEG formats as needed
- Provides detailed logging and error handling

**Dependencies:** Requires Sharp (`npm install sharp`) for image processing.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## About Blockfest

Blockfest is Africa's premier blockchain conference, bringing together builders, founders, investors, and DeFi professionals in Africa.
