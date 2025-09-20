export interface BadgeConfig {
  userPhoto: {
    x: number;
    y: number;
    width: number;
    height: number;
    style: "rounded" | "circle" | "square";
    borderRadius?: number;
  };
  userName: {
    x: number;
    y: number;
    font: string;
    color: string;
    align: CanvasTextAlign;
    maxWidth: number;
    maxHeight: number;
    lineHeight: number;
  };
}

export interface UserGraphic {
  name: string;
  photo: string | null;
}

export interface PhotoUploadState {
  file: File | null;
  preview: string | null;
  isUploading: boolean;
  error: string | null;
}

export interface BadgeGenerationState {
  isGenerating: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  generatedBadge: string | null;
  userName: string | null;
}
