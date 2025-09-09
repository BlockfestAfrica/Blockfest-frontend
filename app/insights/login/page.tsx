import { Metadata } from "next";
import { PasswordProtected } from "@/components/password-protected";

export const metadata: Metadata = {
  title: "Insights Login | Blockfest Africa",
  description: "Login to access Blockfest Africa event insights",
  robots: "noindex, nofollow, noarchive, nosnippet", // Keep completely private
};

export default function InsightsLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
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

      <div className="w-full max-w-md">
        <PasswordProtected>
          <div className="text-center text-white">
            <p>Redirecting to insights...</p>
          </div>
        </PasswordProtected>
      </div>
    </div>
  );
}
