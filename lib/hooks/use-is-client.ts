"use client";

import { useEffect, useState } from "react";

/**
 * Hook to prevent hydration mismatches by ensuring client-side only execution
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}
