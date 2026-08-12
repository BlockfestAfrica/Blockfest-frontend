import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { gotham } from "@/lib/fonts";

export default function NotFound() {
  return (
    <div
      className={`${gotham.className} min-h-screen bg-ground relative overflow-hidden`}
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-blue-light rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-blue rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-ping"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-brand-blue-dark rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-bounce"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center">
          {/* Logo Section */}
          <div className="mb-8">
            <Link href="/" className="inline-block cursor-pointer">
              <Image
                src="/images/logo.svg"
                alt="Blockfest Africa Logo"
                width={180}
                height={60}
                className="mx-auto mb-8 opacity-90 hover:opacity-100 transition-opacity duration-200"
                priority
              />
            </Link>
          </div>

          {/* Main Content */}
          <div className="bg-white/10 rounded-xl border border-white/20 shadow-2xl p-8 md:p-12">
            <div className="mb-8">
              {/* 404 Number with gradient */}
              <div className="relative mb-6">
                <h1 className="text-8xl md:text-9xl font-bold text-white">
                  404
                </h1>
                <div className="absolute inset-0 text-8xl md:text-9xl font-bold text-white opacity-10 blur-sm">
                  404
                </div>
              </div>

              <h2 className="text-3xl font-bold text-white mb-4">
                Page Not Found
              </h2>
              <p className="text-lg text-gray-300 leading-relaxed max-w-lg mx-auto">
                Looks like you&apos;ve wandered off the blockchain! The page
                you&apos;re looking for doesn&apos;t exist, but don&apos;t worry
                – there&apos;s plenty to explore at Africa&apos;s premier Web3
                conference.
              </p>
            </div>

            {/* Action Button */}
            <div className="mb-8">
              <Button
                asChild
                className="w-full md:w-auto px-8 py-4 bg-brand-blue hover:bg-brand-blue-pressed text-white font-bold text-lg rounded-xl transition-colors duration-300"
              >
                <Link href="/">Return Home</Link>
              </Button>
            </div>

            {/* Help Section */}
            <div className="pt-6 border-t border-white/20">
              <p className="text-gray-400 mb-4">
                Need help finding something specific?
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm">
                <a
                  href="mailto:partnership@blockfestafrica.com"
                  className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-300"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  Contact Support
                </a>
                <span className="hidden sm:block text-white/60">•</span>
                <Link
                  href="/#contact"
                  className="text-white/60 hover:text-white transition-colors duration-300"
                >
                  Get in Touch
                </Link>
              </div>
            </div>
          </div>

          {/* Fun Message */}
          <p className="mt-6 text-gray-400 text-sm">
            🌍 Building the future of Web3 in Africa, one block at a time
          </p>
        </div>
      </div>
    </div>
  );
}
