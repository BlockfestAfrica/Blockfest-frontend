"use client";

import { useState, useCallback } from "react";
import { BadgeConfig, UserGraphic, BadgeGenerationState } from "../types";

const TEMPLATE_CONFIG: BadgeConfig = {
  userPhoto: {
    x: 225,
    y: 685,
    width: 1140,
    height: 1140,
    style: "rounded",
    borderRadius: 60,
  },
  userName: {
    x: 1450,
    y: 900,
    font: "bold 140px Bebas Neue",
    color: "#000000",
    align: "left",
    maxWidth: 2000,
    maxHeight: 120,
    lineHeight: 55,
  },
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

export const useBadgeGenerator = () => {
  const [state, setState] = useState<BadgeGenerationState>({
    isGenerating: false,
    progress: 0,
    error: null,
    success: false,
  });

  const generateBadge = useCallback(async (userGraphic: UserGraphic) => {
    const trimmedName = userGraphic.name.trim();

    if (!trimmedName) {
      setState((prev) => ({ ...prev, error: "Please enter your name" }));
      return;
    }

    if (trimmedName.length > 50) {
      setState((prev) => ({
        ...prev,
        error: "Name is too long. Please use a shorter name.",
      }));
      return;
    }

    if (trimmedName.length < 2) {
      setState((prev) => ({
        ...prev,
        error: "Name is too short. Please enter at least 2 characters.",
      }));
      return;
    }

    setState({
      isGenerating: true,
      progress: 0,
      error: null,
      success: false,
    });

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error(
          "Failed to get canvas context. Your browser may not support this feature."
        );
      }

      // Set memory management options
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      setState((prev) => ({ ...prev, progress: 10 }));

      // Load template image
      const templateImg = await loadImage("/images/getdp/template.jpg");

      // Check canvas size for memory management
      const maxCanvasSize = 4000 * 4000; // 16MP max
      const canvasArea = templateImg.width * templateImg.height;

      if (canvasArea > maxCanvasSize) {
        throw new Error("Template image is too large for processing");
      }

      canvas.width = templateImg.width;
      canvas.height = templateImg.height;

      setState((prev) => ({ ...prev, progress: 30 }));

      // Draw template
      ctx.drawImage(templateImg, 0, 0);

      setState((prev) => ({ ...prev, progress: 50 }));

      // Add user data
      if (userGraphic.photo) {
        const userImg = await loadImage(userGraphic.photo);

        // Draw user photo
        const config = TEMPLATE_CONFIG.userPhoto;
        ctx.save();

        if (config.style === "circle") {
          ctx.beginPath();
          ctx.arc(
            config.x + config.width / 2,
            config.y + config.height / 2,
            config.width / 2,
            0,
            2 * Math.PI
          );
          ctx.clip();
        } else if (config.style === "rounded") {
          const radius = config.borderRadius || 20;
          ctx.beginPath();
          ctx.roundRect(
            config.x,
            config.y,
            config.width,
            config.height,
            radius
          );
          ctx.clip();
        } else {
          ctx.beginPath();
          ctx.rect(config.x, config.y, config.width, config.height);
          ctx.clip();
        }

        const scale = Math.max(
          config.width / userImg.width,
          config.height / userImg.height
        );
        const scaledWidth = userImg.width * scale;
        const scaledHeight = userImg.height * scale;

        const drawX = config.x + (config.width - scaledWidth) / 2;
        const drawY = config.y + (config.height - scaledHeight) / 2;

        ctx.drawImage(userImg, drawX, drawY, scaledWidth, scaledHeight);
        ctx.restore();
      }

      // Draw user text
      const nameConfig = TEMPLATE_CONFIG.userName;
      ctx.fillStyle = nameConfig.color;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;

      const fontString = `${nameConfig.font}, Arial, sans-serif`;
      ctx.font = fontString;
      ctx.textAlign = nameConfig.align;

      const uppercaseName = userGraphic.name.toUpperCase();

      // Draw wrapped text
      const words = uppercaseName.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + (currentLine ? " " : "") + words[i];
        const metrics = ctx.measureText(testLine);

        if (metrics.width > nameConfig.maxWidth && currentLine !== "") {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      let y = nameConfig.y;
      for (let i = 0; i < lines.length; i++) {
        if (y > nameConfig.y + nameConfig.maxHeight) {
          break;
        }

        ctx.strokeText(lines[i], nameConfig.x, y);
        ctx.fillText(lines[i], nameConfig.x, y);
        y += nameConfig.lineHeight;
      }

      setState((prev) => ({ ...prev, progress: 80 }));

      // Generate and download badge with memory management
      try {
        const dataURL = canvas.toDataURL("image/png", 0.95); // Slightly compressed for memory

        const link = document.createElement("a");
        link.download = `blockfest-badge-${userGraphic.name
          .replace(/\s+/g, "-")
          .toLowerCase()}.png`;
        link.href = dataURL;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setState({
          isGenerating: false,
          progress: 100,
          error: null,
          success: true,
        });

        // Reset success state after 3 seconds
        setTimeout(() => {
          setState((prev) => ({ ...prev, success: false, progress: 0 }));
        }, 3000);
      } catch {
        throw new Error("Failed to generate download. Image may be too large.");
      } finally {
        // Clean up canvas and context for memory management
        canvas.width = 1;
        canvas.height = 1;
        ctx.clearRect(0, 0, 1, 1);
      }
    } catch (error) {
      setState({
        isGenerating: false,
        progress: 0,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate badge. Please try again.",
        success: false,
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    generateBadge,
    clearError,
  };
};
