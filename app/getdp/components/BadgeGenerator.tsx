"use client";

import { useState, useCallback, useRef } from "react";
import { usePhotoUpload } from "../hooks/usePhotoUpload";
import { useBadgeGenerator } from "../hooks/useBadgeGenerator";
import { Camera, Download, Loader2, X, CheckCircle } from "lucide-react";
import Image from "next/image";

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
    generateBadge,
    clearError,
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

      {/* Main Form */}
      <div className="relative z-10 max-w-md mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/30 p-6 sm:p-8">
          <div className="space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-700"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#005DFF] focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                disabled={isGenerating}
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Profile Photo
              </label>

              {!preview ? (
                <div
                  onClick={openFileDialog}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8 text-center cursor-pointer hover:border-[#005DFF] hover:bg-[#005DFF]/5 transition-all duration-200 group"
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
                    <div className="flex flex-col items-center space-y-3">
                      <div className="p-3 bg-[#005DFF]/10 rounded-full group-hover:bg-[#005DFF]/20 transition-colors">
                        <Camera className="w-6 h-6 text-[#005DFF]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Upload your photo
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          JPG, PNG up to 5MB
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
                    className="w-full h-48 object-cover rounded-xl border border-gray-200"
                  />
                  <button
                    onClick={clearPhoto}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    disabled={isGenerating}
                  >
                    <X className="w-4 h-4" />
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
              disabled={isGenerating || !name.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-[#005DFF] to-[#1B64E4] text-white font-semibold rounded-xl hover:from-[#1B64E4] hover:to-[#005DFF] focus:ring-4 focus:ring-[#005DFF]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating Badge... {progress}%</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Generate My Badge</span>
                </>
              )}
            </button>

            {/* Error Display */}
            {generationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{generationError}</p>
                <button
                  onClick={clearError}
                  className="text-xs text-red-500 underline mt-1 hover:text-red-700"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Built with ❤️ by the{" "}
                <a
                  href="https://x.com/Zer0PulseFi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  ZerØPulse
                </a>{" "}
                team
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Pattern */}
      <div className="fixed bottom-0 left-0 right-0 h-20 pointer-events-none">
        <Image
          src="/images/getdp/footerPattern.png"
          alt="Footer Pattern"
          fill
          className="object-cover opacity-20"
        />
      </div>
    </div>
  );
}
