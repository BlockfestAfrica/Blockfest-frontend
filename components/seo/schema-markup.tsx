import React from "react";
import { jsonLd } from "@/lib/json-ld";

interface BaseSchemaProps {
  type:
    | "Event"
    | "Organization"
    | "WebPage"
    | "FAQPage"
    | "AboutPage"
    | "ContactPage";
  data: Record<string, unknown>;
}

export function BaseSchema({ type, data }: BaseSchemaProps) {
  const baseContext = {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(baseContext) }}
    />
  );
}




// Breadcrumb Schema
interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbData) }}
    />
  );
}
