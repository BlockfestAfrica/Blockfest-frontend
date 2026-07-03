"use client";

import React from "react";
import Image from "next/image";
import {
  X,
  Globe,
  Twitter,
  Linkedin,
  ExternalLink,
  Youtube,
} from "lucide-react";
import { Speaker } from "@/lib/speakers";
import { gotham } from "@/lib/fonts";

interface SpeakerBioModalProps {
  speaker: Speaker | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SpeakerBioModal({
  speaker,
  isOpen,
  onClose,
}: SpeakerBioModalProps) {
  // Handle escape key to close modal
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !speaker) return null;

  // Convert markdown-style content to JSX with bold text, line breaks, and links
  const formatBio = (bio: string) => {
    // First handle line breaks
    const paragraphs = bio.split("\n\n");

    return paragraphs.map((paragraph, paragraphIndex) => {
      // Split by links first
      const linkParts = paragraph.split(/(\[([^\]]+)\]\(([^)]+)\))/g);

      const formattedParagraph = linkParts.map((part, index) => {
        const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          const [, text, url] = linkMatch;

          // Skip social media links that are already displayed as buttons
          const lowerUrl = url.toLowerCase();
          const lowerText = text.toLowerCase();

          // Check if this link matches existing social media profiles
          if (
            (speaker?.twitter &&
              (lowerUrl.includes(
                speaker.twitter
                  .toLowerCase()
                  .replace("https://", "")
                  .replace("http://", "")
              ) ||
                (lowerUrl.includes("twitter.com") &&
                  lowerText.includes("twitter")))) ||
            (speaker?.linkedin &&
              (lowerUrl.includes(
                speaker.linkedin
                  .toLowerCase()
                  .replace("https://", "")
                  .replace("http://", "")
              ) ||
                (lowerUrl.includes("linkedin.com") &&
                  lowerText.includes("linkedin")))) ||
            (speaker?.website &&
              lowerUrl.includes(
                speaker.website
                  .toLowerCase()
                  .replace("https://", "")
                  .replace("http://", "")
              )) ||
            (speaker?.youtube &&
              lowerUrl.includes(
                speaker.youtube
                  .toLowerCase()
                  .replace("https://", "")
                  .replace("http://", "")
              ))
          ) {
            // Return empty for social media that's already shown
            return "";
          }

          // Determine the appropriate icon based on URL
          const getIcon = () => {
            if (
              lowerUrl.includes("twitter.com") ||
              lowerUrl.includes("x.com") ||
              lowerText.includes("twitter")
            ) {
              return <Twitter className="w-4 h-4 inline mr-1" />;
            }
            if (
              lowerUrl.includes("linkedin.com") ||
              lowerText.includes("linkedin")
            ) {
              return <Linkedin className="w-4 h-4 inline mr-1" />;
            }
            if (
              lowerUrl.includes("github.com") ||
              lowerText.includes("github")
            ) {
              return <ExternalLink className="w-4 h-4 inline mr-1" />;
            }
            if (
              lowerUrl.includes("youtube.com") ||
              lowerUrl.includes("youtu.be") ||
              lowerText.includes("youtube")
            ) {
              return <ExternalLink className="w-4 h-4 inline mr-1" />;
            }
            return <ExternalLink className="w-4 h-4 inline mr-1" />;
          };

          return (
            <a
              key={`${paragraphIndex}-${index}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-brand-blue hover:text-brand-blue-dark underline transition-colors font-medium"
            >
              {getIcon()}
              {text}
            </a>
          );
        }

        // Handle bold text (**text**)
        const boldParts = part.split(/(\*\*([^*]+)\*\*)/g);
        return boldParts.map((boldPart, boldIndex) => {
          const boldMatch = boldPart.match(/\*\*([^*]+)\*\*/);
          if (boldMatch) {
            return (
              <strong
                key={`${paragraphIndex}-${index}-${boldIndex}`}
                className="font-semibold"
              >
                {boldMatch[1]}
              </strong>
            );
          }
          return boldPart;
        });
      });

      return (
        <div key={paragraphIndex} className={paragraphIndex > 0 ? "mt-4" : ""}>
          {formattedParagraph}
        </div>
      );
    });
  };

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 transition-opacity duration-300 backdrop-blur-sm bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[90vh] sm:max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 border-t-2 border-gray-200 sm:border-2 sm:border-gray-200 shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 fade-in-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Handle Bar */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header with close button */}
        <div className="sticky top-0 bg-gradient-to-r from-white to-gray-50 rounded-t-2xl sm:rounded-t-2xl px-4 py-3 sm:p-4 md:p-6 border-b border-gray-200 flex justify-between items-center">
          <h2
            className={`${gotham.className} text-lg sm:text-xl md:text-2xl font-semibold text-gray-900`}
          >
            Speaker Bio
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 sm:p-4 md:p-6">
          {/* Speaker Info */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <div className="w-24 h-24 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-gray-200 ring-4 ring-gray-100">
                <Image
                  src={speaker.image}
                  alt={speaker.name}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>

            <div className="flex-grow text-center sm:text-left">
              <h3
                className={`${gotham.className} text-xl sm:text-xl md:text-2xl font-bold text-gray-900 mb-3`}
              >
                {speaker.name}
              </h3>

              <div className="space-y-3 mb-4">
                {/* Job Title */}
                <div className="flex items-start justify-center sm:justify-start">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 sm:px-4 py-2 max-w-full">
                    <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed">
                      {speaker.title}
                    </p>
                  </div>
                </div>

                {/* Company */}
                {speaker.company && (
                  <div className="flex items-center justify-center sm:justify-start">
                    <p className="text-sm sm:text-base text-brand-blue font-semibold">
                      {speaker.company}
                    </p>
                  </div>
                )}
              </div>

              {/* Social Links */}
              <div className="flex gap-3 justify-center sm:justify-start flex-wrap">
                {speaker.twitter && (
                  <a
                    href={speaker.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-11 h-11 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark transition-colors touch-manipulation"
                    aria-label={`Follow ${speaker.name} on Twitter`}
                  >
                    <Twitter className="w-5 h-5" />
                  </a>
                )}
                {speaker.linkedin && (
                  <a
                    href={speaker.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-11 h-11 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark transition-colors touch-manipulation"
                    aria-label={`Connect with ${speaker.name} on LinkedIn`}
                  >
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
                {speaker.youtube && (
                  <a
                    href={speaker.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-11 h-11 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark transition-colors touch-manipulation"
                    aria-label={`Watch ${speaker.name} on YouTube`}
                  >
                    <Youtube className="w-5 h-5" />
                  </a>
                )}
                {speaker.website && (
                  <a
                    href={speaker.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-11 h-11 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark transition-colors touch-manipulation"
                    aria-label={`Visit ${speaker.name}'s website`}
                  >
                    <Globe className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {speaker.bio && (
            <div className="border-t border-gray-100 pt-4 sm:pt-6 mt-6">
              <h4
                className={`${gotham.className} text-lg sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4`}
              >
                About {speaker.name.split(" ")[0]}
              </h4>
              <div className="text-gray-700 leading-relaxed text-base sm:text-base">
                {formatBio(speaker.bio)}
              </div>
            </div>
          )}

          {/* No bio message */}
          {!speaker.bio && (
            <div className="border-t border-gray-100 pt-4 sm:pt-6 mt-6">
              <div className="flex flex-col items-center justify-center text-center py-8 sm:py-12">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 text-brand-blue"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h4
                  className={`${gotham.className} text-lg sm:text-xl font-semibold text-gray-900 mb-2`}
                >
                  Biography in Development
                </h4>
                <p className="text-gray-600 text-base sm:text-base max-w-md leading-relaxed px-4">
                  We&apos;re currently crafting a comprehensive biography for{" "}
                  {speaker.name.split(" ")[0]}. Check back soon for their
                  inspiring story and professional journey.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
