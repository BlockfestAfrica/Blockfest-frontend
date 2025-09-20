"use client";

import { useState, useCallback, useRef } from "react";
import { usePhotoUpload } from "../hooks/usePhotoUpload";
import { useBadgeGenerator } from "../hooks/useBadgeGenerator";
import {
  Camera,
  Download,
  Loader2,
  X,
  CheckCircle,
  Share,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function BadgeGenerator() {
  const [name, setName] = useState("");
  const {
    preview,
    isUploading,
    error: photoError,
    uploadPhoto,
    clearPhoto,
  } = usePhotoUpload();
  const {
    isGenerating,
    progress,
    error: generationError,
    success,
    generatedBadge,
    userName,
    generateBadge,
    clearError,
    downloadBadge,
    shareOnX,
    resetBadge,
  } = useBadgeGenerator();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        uploadPhoto(selectedFile);
      }
    },
    [uploadPhoto]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        uploadPhoto(droppedFile);
      }
    },
    [uploadPhoto]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!preview) {
      alert("Please upload your photo");
      return;
    }

    await generateBadge({
      name: name.trim(),
      photo: preview,
    });
  }, [name, preview, generateBadge]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 font-sans">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Radial gradients for depth */}
        <div
          className="absolute inset-0"
          style={{
            background: `
            radial-gradient(circle at 20% 80%, rgba(0, 93, 255, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(27, 100, 228, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(242, 203, 69, 0.08) 0%, transparent 50%)
          `,
          }}
        ></div>
        {/* Floating shapes */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#005DFF]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F2CB45]/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 pt-8 sm:pt-12 pb-6 sm:pb-8 text-center px-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
          Create Your Blockfest Africa Badge
        </h1>
        <p className="text-gray-300 font-medium text-base sm:text-lg max-w-lg mx-auto px-2">
          Generate your personalized conference badge and make it your display
          picture.
        </p>
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-20">
        <div
          className={`mx-auto ${
            success
              ? "max-w-7xl lg:grid lg:grid-cols-5 lg:gap-8 lg:items-start"
              : "max-w-md"
          }`}
        >
          {/* Form Section */}
          <div className={success ? "lg:col-span-2" : ""}>
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/30 p-6 sm:p-8 lg:p-10">
              <div className="space-y-6 sm:space-y-7 lg:space-y-8">
                {/* Name Input */}
                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="block text-sm sm:text-base lg:text-lg font-semibold text-gray-700"
                  >
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    maxLength={50}
                    minLength={2}
                    className="w-full px-4 py-4 sm:px-5 sm:py-4 lg:px-6 lg:py-5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#005DFF] focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400 text-base sm:text-lg"
                    disabled={isGenerating}
                  />
                  {name.length > 40 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      {50 - name.length} characters remaining
                    </p>
                  )}
                </div>

                {/* Photo Upload */}
                <div className="space-y-2">
                  <label className="block text-sm sm:text-base lg:text-lg font-semibold text-gray-700">
                    Profile Photo
                  </label>

                  {!preview ? (
                    <div
                      onClick={openFileDialog}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8 lg:p-10 text-center cursor-pointer hover:border-[#005DFF] hover:bg-[#005DFF]/5 active:bg-[#005DFF]/10 transition-all duration-200 group touch-manipulation min-h-[180px] sm:min-h-[200px] lg:min-h-[220px] flex items-center justify-center"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openFileDialog();
                        }
                      }}
                      aria-label="Upload profile photo"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isGenerating || isUploading}
                      />

                      {isUploading ? (
                        <div className="flex flex-col items-center space-y-2">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                          <p className="text-sm text-gray-600">Uploading...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-4">
                          <div className="p-4 sm:p-5 lg:p-6 bg-[#005DFF]/10 rounded-full group-hover:bg-[#005DFF]/20 transition-colors">
                            <Camera className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-[#005DFF]" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm sm:text-base lg:text-lg font-medium text-gray-700">
                              <span className="hidden sm:inline">
                                Drag & drop or c
                              </span>
                              <span className="sm:hidden">C</span>lick to upload
                            </p>
                            <p className="text-xs sm:text-sm lg:text-base text-gray-500 mt-1">
                              JPG, PNG, WebP up to 10MB
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt="Profile Preview"
                        className="w-full h-72 sm:h-80 lg:h-96 object-cover rounded-xl border border-gray-200"
                      />
                      <button
                        onClick={clearPhoto}
                        className="absolute top-2 right-2 p-2 sm:p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors min-w-[44px] min-h-[44px] sm:min-w-auto sm:min-h-auto flex items-center justify-center"
                        disabled={isGenerating}
                        aria-label="Remove photo"
                      >
                        <X className="w-5 h-5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  )}

                  {photoError && (
                    <p className="text-sm text-red-600 mt-1">{photoError}</p>
                  )}
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !name.trim() || !preview}
                  className="w-full py-4 px-6 sm:py-5 sm:px-8 lg:py-6 lg:px-10 bg-gradient-to-r from-[#005DFF] to-[#1B64E4] text-white font-semibold rounded-xl hover:from-[#1B64E4] hover:to-[#005DFF] focus:ring-4 focus:ring-[#005DFF]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg text-base sm:text-lg lg:text-xl"
                  title={
                    !name.trim() || !preview
                      ? "Please add both your name and photo"
                      : "Generate your badge"
                  }
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                      <span className="truncate">
                        <span className="hidden xs:inline">
                          Generating Badge...{" "}
                        </span>
                        <span className="xs:hidden">Generating... </span>
                        {progress}%
                      </span>
                    </>
                  ) : success ? (
                    <>
                      <ChevronDown className="w-5 h-5 flex-shrink-0 animate-bounce lg:hidden" />
                      <ChevronRight className="w-5 h-5 flex-shrink-0 animate-bounce hidden lg:block" />
                      <span className="lg:hidden">Ready! 👇</span>
                      <span className="hidden lg:inline">Ready! 👉</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">
                        <span className="hidden xs:inline">
                          Generate My Badge
                        </span>
                        <span className="xs:hidden">Generate</span>
                      </span>
                    </>
                  )}
                </button>

                {/* Error Display */}
                {generationError && (
                  <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 break-words leading-relaxed">
                      {generationError}
                    </p>
                    <button
                      onClick={clearError}
                      className="text-xs text-red-500 underline mt-2 hover:text-red-700 min-h-[44px] sm:min-h-auto py-2 sm:py-0 touch-manipulation"
                      aria-label="Dismiss error message"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Arrow Indicator - Lower Position */}
          {success && generatedBadge && (
            <div className="lg:col-span-1 hidden lg:flex lg:items-end lg:justify-center lg:min-h-[400px] lg:pb-16">
              <div className="flex flex-col items-center space-y-3 animate-bounce">
                <ChevronRight className="w-10 h-10 text-white/80" />
                <p className="text-white/80 text-base font-medium text-center">
                  Your badge
                  <br />
                  is ready!
                </p>
                <ChevronRight className="w-8 h-8 text-white/60" />
              </div>
            </div>
          )}

          {/* Result Section */}
          {success && generatedBadge && (
            <div className="lg:col-span-2 mt-6 lg:mt-0">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/30 p-6 sm:p-8 lg:p-10 w-full">
                <div className="text-center space-y-6">
                  {/* Success Header */}
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 lg:w-18 lg:h-18 text-green-500" />
                    </div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">
                      Your Badge is Ready!
                    </h2>
                    <p className="text-sm sm:text-base lg:text-lg text-gray-600">
                      Welcome to Blockfest Africa 2025, {userName}! 🎉
                    </p>
                  </div>

                  {/* Generated Badge Preview - Much Wider */}
                  <div className="space-y-4">
                    <img
                      src={generatedBadge}
                      alt={`${userName}'s Blockfest Africa Badge`}
                      className="w-full max-w-2xl lg:max-w-full mx-auto rounded-xl shadow-lg border border-gray-200"
                    />
                  </div>

                  {/* Action Buttons - Horizontal Layout on Desktop */}
                  <div className="space-y-4 lg:space-y-3">
                    {/* Share on X Button */}
                    <button
                      onClick={shareOnX}
                      className="w-full py-4 px-8 lg:py-3 lg:px-6 bg-gradient-to-r from-[#1DA1F2] to-[#0d8bd4] text-white font-semibold rounded-xl hover:from-[#0d8bd4] hover:to-[#1DA1F2] focus:ring-4 focus:ring-[#1DA1F2]/20 transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg text-lg lg:text-base"
                    >
                      <Share className="w-5 h-5 lg:w-4 lg:h-4 flex-shrink-0" />
                      <span>Share on X</span>
                    </button>

                    {/* Secondary Actions - Wider on Desktop */}
                    <div className="flex gap-3 lg:gap-4">
                      <button
                        onClick={downloadBadge}
                        className="flex-1 py-3 px-4 lg:py-3 lg:px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 text-base"
                      >
                        <Download className="w-4 h-4 flex-shrink-0" />
                        <span>Download</span>
                      </button>

                      <button
                        onClick={resetBadge}
                        className="flex-1 py-3 px-4 lg:py-3 lg:px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 text-base"
                      >
                        <RotateCcw className="w-4 h-4 flex-shrink-0" />
                        <span>Create New</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
