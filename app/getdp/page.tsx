import BadgeGenerator from "./components/BadgeGenerator";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Badge Generator - Blockfest Africa 2025",
  description:
    "Generate your personalized Blockfest Africa 2025 conference badge",
  keywords: ["blockfest", "africa", "badge", "generator", "conference", "2025"],
};

export default function GetDPPage() {
  return <BadgeGenerator />;
}
