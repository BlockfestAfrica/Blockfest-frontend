"use client";

import { useState, useCallback } from "react";
import { PhotoUploadState } from "../types";

export const usePhotoUpload = () => {
  const [state, setState] = useState<PhotoUploadState>({
    file: null,
    preview: null,
    isUploading: false,
    error: null,
  });

  const uploadPhoto = useCallback((file: File) => {
    // File type validation (MIME type and extension)
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (!file.type.startsWith("image/") || !allowedTypes.includes(file.type)) {
      setState((prev) => ({
        ...prev,
        error: "Please select a valid image file (JPG, PNG, WebP)",
      }));
      return;
    }

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      setState((prev) => ({
        ...prev,
        error: "File extension must be JPG, PNG, or WebP",
      }));
      return;
    }

    // File size validation
    if (file.size > 10 * 1024 * 1024) {
      setState((prev) => ({
        ...prev,
        error: "Image file size should be less than 10MB",
      }));
      return;
    }

    // File size minimum check (avoid tiny images)
    if (file.size < 1024) {
      setState((prev) => ({
        ...prev,
        error: "Image file seems too small. Please select a valid image.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isUploading: true, error: null }));

    const reader = new FileReader();

    // Add timeout for file reading
    const timeoutId = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isUploading: false,
        error: "File upload timed out. Please try again.",
      }));
    }, 30000); // 30 second timeout

    reader.onload = (e) => {
      clearTimeout(timeoutId);
      const result = e.target?.result as string;

      if (!result) {
        setState((prev) => ({
          ...prev,
          isUploading: false,
          error: "Failed to process image file",
        }));
        return;
      }

      // Validate image dimensions
      const img = new Image();
      img.onload = () => {
        // Check minimum dimensions for quality
        if (img.width < 200 || img.height < 200) {
          setState((prev) => ({
            ...prev,
            isUploading: false,
            error: "Image should be at least 200x200 pixels for best quality",
          }));
          return;
        }

        // Check maximum dimensions to prevent memory issues
        if (img.width > 4000 || img.height > 4000) {
          setState((prev) => ({
            ...prev,
            isUploading: false,
            error: "Image dimensions should not exceed 4000x4000 pixels",
          }));
          return;
        }

        // All validations passed
        setState({
          file,
          preview: result,
          isUploading: false,
          error: null,
        });
      };

      img.onerror = () => {
        setState((prev) => ({
          ...prev,
          isUploading: false,
          error: "Invalid or corrupted image file",
        }));
      };

      img.src = result;
    };

    reader.onerror = () => {
      clearTimeout(timeoutId);
      setState((prev) => ({
        ...prev,
        isUploading: false,
        error: "Failed to read file. Please try again.",
      }));
    };

    try {
      reader.readAsDataURL(file);
    } catch {
      clearTimeout(timeoutId);
      setState((prev) => ({
        ...prev,
        isUploading: false,
        error: "Error processing file. Please select a different image.",
      }));
    }
  }, []);

  const clearPhoto = useCallback(() => {
    setState({
      file: null,
      preview: null,
      isUploading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    uploadPhoto,
    clearPhoto,
  };
};
