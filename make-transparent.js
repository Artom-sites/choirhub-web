const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const logoPath = path.join(__dirname, 'assets/logo.png');
        const logoBuffer = await sharp(logoPath).toBuffer();

        // Create a 1024x1024 rounded rect mask
        const maskSvg = Buffer.from(`
      <svg width="1024" height="1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
         <rect x="0" y="0" width="1024" height="1024" rx="256" ry="256" fill="#FFFFFF"/>
      </svg>
    `);

        // Apply mask to logo to make corners transparent
        const roundedLogo = await sharp(logoBuffer)
            .resize(1024, 1024)
            .ensureAlpha()
            .composite([{ input: maskSvg, blend: 'dest-in' }])
            .png()
            .toBuffer();

        // Write THIS directly as splash.png, so capacitor-assets centers it
        const splashPath = path.join(__dirname, 'assets/splash.png');
        await sharp(roundedLogo).toFile(splashPath);
        console.log("Wrote", splashPath);

        const splashDarkPath = path.join(__dirname, 'assets/splash-dark.png');
        await sharp(roundedLogo).toFile(splashDarkPath);
        console.log("Wrote", splashDarkPath);

        console.log("Images created successfully.");
    } catch (err) {
        console.error("Error running sharp:", err);
    }
}

main();
