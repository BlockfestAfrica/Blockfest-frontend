"use client";

import { useAuth } from "@/components/password-protected";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <Button
      onClick={logout}
      variant="outline"
      size="sm"
      className="flex items-center gap-1.5 sm:gap-2 bg-red-600 border-red-600 text-white hover:bg-red-700 hover:border-red-700 transition-all duration-300 transform hover:scale-105 px-3 sm:px-4 py-2 text-xs sm:text-sm"
    >
      <svg
        className="w-3.5 h-3.5 sm:w-4 sm:h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
      <span className="whitespace-nowrap">Logout</span>
    </Button>
  );
}
