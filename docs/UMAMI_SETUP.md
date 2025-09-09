# Umami Analytics Setup Guide

This project uses Umami Analytics - an open-source, privacy-focused analytics platform.

## What is Umami?

Umami is a simple, fast, privacy-focused analytics platform. It's:

- ✅ Open source
- ✅ Privacy-focused (GDPR compliant)
- ✅ Lightweight
- ✅ Self-hostable
- ✅ Cookie-free tracking

## Quick Setup

### 1. Set Up Umami Instance

#### Option A: Use Umami Cloud (Easiest)

1. Go to [Umami Cloud](https://cloud.umami.is)
2. Sign up for an account
3. Click "Settings" → "Websites" → "Add website"
4. Fill in your website details
5. Click "Edit" on your website → "Tracking Code" tab
6. Copy the Website ID and Script URL

#### Option B: Self-Host Umami

1. Deploy Umami using their [deployment guide](https://umami.is/docs/install)
2. Add your website in the Umami dashboard
3. Get your Website ID and Script URL

### 2. Configure Environment Variables

Add these variables to your `.env.local` file:

```env
# Umami Analytics Configuration
NEXT_PUBLIC_UMAMI_WEBSITE_ID=YOUR_UMAMI_WEBSITE_ID
NEXT_PUBLIC_UMAMI_SRC=YOUR_UMAMI_SCRIPT_URL   # e.g., https://cloud.umami.is/script.js
```

### 3. Restart Development Server

```bash
npm run dev
```

## Usage Examples

### Using the Custom Hook

```tsx
import { useUmami } from "@/lib/hooks/use-umami";

function MyComponent() {
  const { trackButtonClick, trackPageView } = useUmami();

  return (
    <button onClick={() => trackButtonClick("CTA Button", "Header")}>
      Click me
    </button>
  );
}
```

### Available Tracking Functions

- `track()` - Custom event tracking
- `identify()` - User identification
- `trackButtonClick()` - Button clicks
- `trackPageView()` - Page views
- `trackFormSubmit()` - Form submissions
- `trackRegistration()` - Registration attempts
- `trackError()` - Error tracking

## Features Already Implemented

### Hero Section

- ✅ "Register Now" button clicks
- ✅ "Become a sponsor" button clicks

### Partners Section

- ✅ "Register Now" button clicks
- ✅ "Become a sponsor" button clicks

### System Monitoring

- ✅ JavaScript error tracking
- ✅ Performance monitoring
- ✅ Core Web Vitals tracking

## Verification

1. Visit your website
2. Go to your Umami dashboard at [cloud.umami.is](https://cloud.umami.is)
3. You should see real-time data appear
4. Click buttons to test event tracking

## Environment Variables

```env
# Required
NEXT_PUBLIC_UMAMI_WEBSITE_ID=    # Your Umami website ID
NEXT_PUBLIC_UMAMI_SRC=           # Your Umami script URL

# Optional
NEXT_PUBLIC_SITE_URL=            # Your site URL (used for domain filtering)
```

## Troubleshooting

### Script Not Loading

- Check environment variables are set correctly
- Verify your Umami instance is accessible
- Check browser console for errors

### Events Not Tracking

- Ensure `window.umami` is available
- Check network tab for outgoing requests
- Verify Website ID matches your dashboard

## Documentation

- [Umami Documentation](https://umami.is/docs)
- [GitHub Repository](https://github.com/umami-software/umami)
- [Community Discord](https://discord.gg/4dz4zcXYrQ)
