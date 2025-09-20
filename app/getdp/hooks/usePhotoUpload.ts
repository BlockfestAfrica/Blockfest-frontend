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
    if (!file.type.startsWith("image/")) {
      setState((prev) => ({
        ...prev,
        error: "Please select a valid image file",
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setState((prev) => ({
        ...prev,
        error: "Image file size should be less than 5MB",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isUploading: true, error: null }));

    const reader = new FileReader();
    reader.onload = (e) => {
      setState({
        file,
        preview: e.target?.result as string,
        isUploading: false,
        error: null,
      });
    };

    reader.onerror = () => {
      setState((prev) => ({
        ...prev,
        isUploading: false,
        error: "Failed to read file",
      }));
    };

    reader.readAsDataURL(file);
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
