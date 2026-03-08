# Schema Markup Implementation - Blockf3st Africa 2026

## Overview

This document outlines the JSON-LD structured data implementation for Blockf3st Africa's website, optimized for the 2026 dual-event format (South Africa & Lagos).

## Schema Components

### Primary Schema File: `components/seo/schema-markup-2026.tsx`

Contains all 2026-specific schemas:

1. **EventSchema** - Dual event markup for both South Africa and Lagos events
2. **OrganizationSchema** - Blockfest Africa organization details with 2025 achievements
3. **WebsiteSchema** - Website structure and search functionality
4. **BreadcrumbSchema** - Navigation structure for subpages
5. **Event2025Schema** - Archive schema for the 2025 Lagos event

### Legacy Schema File: `components/seo/schema-markup.tsx`

Maintained for backward compatibility, used by:
- FAQ page (`BaseSchema`)
- Schedule page (`BaseSchema`)
- Badge generator page (`BaseSchema`)
- Speaker pages (`BreadcrumbSchema`)

## Page Implementation

| Page | Schema Components |
|------|-------------------|
| Homepage (`/`) | EventSchema, OrganizationSchema, WebsiteSchema |
| 2025 Recap (`/blockfest-2025`) | Event2025Schema |
| Speakers (`/speakers`) | BreadcrumbSchema, SpeakersSchema |
| FAQ (`/faq`) | FAQSchema, BaseSchema |
| Schedule (`/schedule`) | BaseSchema |

## Key Event Data

All event data is centralized in `lib/events.ts`:

```typescript
// 2026 Events
blockfest2026South Africa  // May 2026, South Africa
blockfest2026Lagos         // October 2026, Nigeria

// 2025 Archive
blockfest2025Lagos         // October 2025, Nigeria (completed)
```

## Validation

Test your schema markup at:
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)

## Best Practices

1. Keep event dates updated in `lib/events.ts`
2. Update social media links in OrganizationSchema when needed
3. Add new speakers to `lib/speakers.ts` for SpeakersSchema
4. Update FAQ content in `lib/faq-data.ts` for FAQSchema
