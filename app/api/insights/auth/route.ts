import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto, { timingSafeEqual } from "crypto";

// In-memory rate limiting storage (in production, use Redis or a database)
const rateLimitStore = new Map<
  string,
  { attempts: number; lastAttempt: number }
>();

// Rate limiting configuration
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes after max attempts

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now - data.lastAttempt > WINDOW_MS) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

function getRealIP(request: NextRequest): string {
  // Get real IP address, accounting for proxies
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1" // fallback for development
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record) {
    return false;
  }

  // If lockout period has passed, reset the record
  if (now - record.lastAttempt > LOCKOUT_DURATION) {
    rateLimitStore.delete(ip);
    return false;
  }

  // If within window and max attempts reached, rate limit
  if (
    record.attempts >= MAX_ATTEMPTS &&
    now - record.lastAttempt < LOCKOUT_DURATION
  ) {
    return true;
  }

  return false;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now - record.lastAttempt > WINDOW_MS) {
    // New record or outside window
    rateLimitStore.set(ip, { attempts: 1, lastAttempt: now });
  } else {
    // Increment attempts
    record.attempts++;
    record.lastAttempt = now;
    rateLimitStore.set(ip, record);
  }
}

function clearFailedAttempts(ip: string): void {
  rateLimitStore.delete(ip);
}

// Server-side only password (NOT exposed to client)
// Server-side only password (NOT exposed to client)
const INSIGHTS_PASSWORD = process.env.INSIGHTS_PASSWORD;

if (!INSIGHTS_PASSWORD) {
  throw new Error("INSIGHTS_PASSWORD environment variable is not configured");
}

// Generate secure session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Validate session token
function validateSessionToken(token: string): boolean {
  // In production, validate against database or secure storage
  // For now, we'll use a simple format check
  return /^[a-f0-9]{64}$/.test(token);
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getRealIP(request);

    // Rate limiting check
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { password } = await request.json();

    // Input validation
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Validate password server-side using constant-time comparison
    const passwordBuffer = Buffer.from(password);
    const expectedBuffer = Buffer.from(INSIGHTS_PASSWORD!); // Already checked above

    if (
      passwordBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(passwordBuffer, expectedBuffer)
    ) {
      // Record failed attempt for rate limiting
      recordFailedAttempt(clientIP);

      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(clientIP);

    // Generate secure session token
    const sessionToken = generateSessionToken();

    // Set secure HTTP-only cookie
    const response = NextResponse.json(
      { success: true, message: "Authentication successful" },
      { status: 200 }
    );

    // Set secure cookie with session token
    response.cookies.set("insights_session", sessionToken, {
      httpOnly: true, // Not accessible via JavaScript
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict", // CSRF protection
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/", // Available for all routes
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("insights_session")?.value;

    if (!sessionToken || !validateSessionToken(sessionToken)) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true }, { status: 200 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

export async function DELETE() {
  // Logout - clear session cookie with matching attributes
  const response = NextResponse.json(
    { success: true, message: "Logged out successfully" },
    { status: 200 }
  );

  // Properly delete cookie with matching attributes
  response.cookies.set("insights_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });

  return response;
}
