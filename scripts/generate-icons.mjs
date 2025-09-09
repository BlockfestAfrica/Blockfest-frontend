// SEO Image Generation Script
// Generates all required SEO images from logo.svg
// Run: npm install sharp
// Then: node scripts/generate-icons.mjs

import sharp from "sharp";
import fs from "fs";
import path from "path";

const logoPath = "./public/images/logo.svg";
const publicDir = "./public/";
const imagesDir = "./public/images/";

// Image specifications for SEO
const imageSpecs = [
  // Favicons (root level)
  {
    name: "favicon-16x16.png",
    width: 16,
    height: 16,
    format: "png",
    location: publicDir,
    description: "Small browser favicon",
  },
  {
    name: "favicon-32x32.png",
    width: 32,
    height: 32,
    format: "png",
    location: publicDir,
    description: "Standard browser favicon",
  },

  // Apple Touch Icons (root level)
  {
    name: "apple-touch-icon.png",
    width: 180,
    height: 180,
    format: "png",
    location: publicDir,
    description: "iOS home screen icon",
  },

  // PWA Icons (root level)
  {
    name: "icon-192.png",
    width: 192,
    height: 192,
    format: "png",
    location: publicDir,
    description: "PWA app icon (small)",
  },
  {
    name: "icon-512.png",
    width: 512,
    height: 512,
    format: "png",
    location: publicDir,
    description: "PWA app icon (large)",
  },

  // Maskable PWA Icons (root level)
  {
    name: "icon-maskable-192.png",
    width: 192,
    height: 192,
    format: "png",
    location: publicDir,
    description: "PWA maskable icon (small)",
  },
  {
    name: "icon-maskable-512.png",
    width: 512,
    height: 512,
    format: "png",
    location: publicDir,
    description: "PWA maskable icon (large)",
  },

  // Windows Tiles (root level)
  {
    name: "mstile-150x150.png",
    width: 150,
    height: 150,
    format: "png",
    location: publicDir,
    description: "Windows tile icon",
  },

  // Social Media Images (images directory)
  {
    name: "og-image.jpg",
    width: 1200,
    height: 630,
    format: "jpeg",
    location: imagesDir,
    description: "Open Graph image for social sharing",
  },
  {
    name: "og-image-square.jpg",
    width: 1200,
    height: 1200,
    format: "jpeg",
    location: imagesDir,
    description: "Square Open Graph image",
  },
  {
    name: "twitter-image.jpg",
    width: 1200,
    height: 630,
    format: "jpeg",
    location: imagesDir,
    description: "Twitter card image",
  },

  // PWA Screenshots (root level)
  {
    name: "screenshot-wide.png",
    width: 1280,
    height: 720,
    format: "png",
    location: publicDir,
    description: "PWA screenshot (desktop)",
  },
  {
    name: "screenshot-narrow.png",
    width: 720,
    height: 1280,
    format: "png",
    location: publicDir,
    description: "PWA screenshot (mobile)",
  },
];

async function ensureDirectories() {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
}

async function generateImage(spec) {
  try {
    const outputPath = path.join(spec.location, spec.name);

    let sharpInstance = sharp(logoPath);

    // For social media images (large rectangular), center the logo
    if (spec.width >= 1200 && spec.height >= 630) {
      // Create a transparent background and center the logo
      const logoSize = Math.min(spec.width * 0.4, spec.height * 0.6); // Logo takes up 40% of width or 60% of height

      sharpInstance = sharpInstance
        .resize(Math.round(logoSize), Math.round(logoSize), {
          fit: "inside",
          withoutEnlargement: true,
        })
        .extend({
          top: Math.round((spec.height - logoSize) / 2),
          bottom: Math.round((spec.height - logoSize) / 2),
          left: Math.round((spec.width - logoSize) / 2),
          right: Math.round((spec.width - logoSize) / 2),
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
        });
    } else {
      // For icons, just resize to fit
      sharpInstance = sharpInstance.resize(spec.width, spec.height, {
        fit: "inside",
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
      });
    }

    // Apply format-specific options
    if (spec.format === "png") {
      sharpInstance = sharpInstance.png({ quality: 90 });
    } else if (spec.format === "jpeg") {
      sharpInstance = sharpInstance.jpeg({ quality: 90, background: "white" });
    }

    await sharpInstance.toFile(outputPath);

    return { success: true, spec };
  } catch (error) {
    return { success: false, spec, error };
  }
}

async function generateAllImages() {
  console.log("🚀 Starting SEO image generation...\n");

  // Check if logo exists
  if (!fs.existsSync(logoPath)) {
    console.error(`❌ Logo file not found: ${logoPath}`);
    process.exit(1);
  }

  await ensureDirectories();

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  // Process all images
  for (const spec of imageSpecs) {
    console.log(
      `📐 Generating ${spec.name} (${spec.width}x${spec.height}) - ${spec.description}`
    );

    const result = await generateImage(spec);
    results.push(result);

    if (result.success) {
      successCount++;
      console.log(`   ✅ Success`);
    } else {
      errorCount++;
      console.log(`   ❌ Error: ${result.error.message}`);
    }
  }

  // Summary
  console.log("\n📊 Generation Summary:");
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📁 Total files: ${imageSpecs.length}`);

  if (successCount > 0) {
    console.log("\n📍 Generated files:");

    const rootFiles = results.filter(
      (r) => r.success && r.spec.location === publicDir
    );
    const imageFiles = results.filter(
      (r) => r.success && r.spec.location === imagesDir
    );

    if (rootFiles.length > 0) {
      console.log("\n   📁 /public/ (root level):");
      rootFiles.forEach((r) =>
        console.log(`      - ${r.spec.name} (${r.spec.width}x${r.spec.height})`)
      );
    }

    if (imageFiles.length > 0) {
      console.log("\n   📁 /public/images/:");
      imageFiles.forEach((r) =>
        console.log(`      - ${r.spec.name} (${r.spec.width}x${r.spec.height})`)
      );
    }
  }

  if (errorCount === 0) {
    console.log("\n🎉 All SEO images generated successfully!");
    console.log("🔍 Your website now has complete SEO image optimization.");
  } else {
    console.log(
      `\n⚠️  Generated ${successCount} images with ${errorCount} errors.`
    );
  }
}

// Run the generation
generateAllImages().catch(console.error);
