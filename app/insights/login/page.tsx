import { Metadata } from "next";
import { LoginForm } from "@/components/insights/login-form";

export const metadata: Metadata = {
  title: "Insights Login | Blockfest Africa",
  description: "Login to access Blockfest Africa event insights",
  robots: "noindex, nofollow, noarchive, nosnippet", // Keep completely private
};

export default function InsightsLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
      {/* Disable Umami tracking for this page */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if (typeof window !== 'undefined') {
              // Disable Umami tracking for this page
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('umami.disabled', 'true');
              }
              // Also disable via window object if available
              if (window.umami) {
                window.umami.disabled = true;
              }
            }
          `,
        }}
      />

      <LoginForm />
    </div>
  );
}
