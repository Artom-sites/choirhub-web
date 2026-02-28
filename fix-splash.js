const sharp = require('sharp');
const path = require('path');

const ROOT = '/Users/artem/telegram app/choir-app';

async function main() {
    const logoBuffer = await sharp(path.join(ROOT, 'assets/logo.png'))
        .resize(1024, 1024)
        .toBuffer();

    console.log('Logo loaded');

    // Create rounded mask
    const maskSvg = Buffer.from(
        '<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="0" y="0" width="1024" height="1024" rx="256" ry="256" fill="white"/>' +
        '</svg>'
    );

    // Apply mask to logo to round corners
    const roundedLogo = await sharp(logoBuffer)
        .ensureAlpha()
        .composite([{ input: maskSvg, blend: 'dest-in' }])
        .png()
        .toBuffer();

    console.log('Rounded logo created');

    // Create dark background matching #09090b
    const darkBg = await sharp({
        create: {
            width: 1024,
            height: 1024,
            channels: 4,
            background: { r: 9, g: 9, b: 11, alpha: 255 }
        }
    }).png().toBuffer();

    console.log('Dark bg created');

    // Composite rounded logo onto opaque dark background
    const finalIcon = await sharp(darkBg)
        .composite([{ input: roundedLogo, gravity: 'center' }])
        .png()
        .toBuffer();

    console.log('Final icon composited');

    // Write to all splash imageset files
    const dir = path.join(ROOT, 'ios/App/App/Assets.xcassets/Splash.imageset');
    const files = [
        'Default@1x~universal~anyany.png',
        'Default@2x~universal~anyany.png',
        'Default@3x~universal~anyany.png',
        'Default@1x~universal~anyany-dark.png',
        'Default@2x~universal~anyany-dark.png',
        'Default@3x~universal~anyany-dark.png'
    ];

    for (const f of files) {
        const p = path.join(dir, f);
        await sharp(finalIcon).toFile(p);
        console.log('Wrote', f);
    }

    // Verify corner pixel is dark (not white/transparent)
    const { data } = await sharp(path.join(dir, files[0]))
        .raw()
        .toBuffer({ resolveWithObject: true });
    console.log('Verification - Top-left pixel RGBA:', data[0], data[1], data[2], data[3]);
    console.log('DONE!');
}

main().catch(e => console.error('ERROR:', e));
