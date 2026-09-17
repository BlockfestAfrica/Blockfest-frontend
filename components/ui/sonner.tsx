"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      /*
       * Top, not bottom.
       *
       * At the default bottom position a toast spans the full width of a narrow
       * viewport for four seconds, directly over the approve and reject buttons
       * a reviewer is about to press next. In a queue worked at speed that is a
       * mis-tap waiting to happen. It floats above the sticky headers on both
       * the console and the marketing pages, which is the right stacking for a
       * transient notice.
       */
      position="top-center"
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
