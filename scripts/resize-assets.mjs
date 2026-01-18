
import Jimp from 'jimp';
import path from 'path';

const SITE_ROOT = 'apps/omnihub-site/public';
const FAVICON_SOURCE = path.join(SITE_ROOT, 'favicon_v2.png');
const LOGO_SOURCE = path.join(SITE_ROOT, 'logo_header.png');

async function resize() {
  console.log('Reading source images...');
  const favicon = await Jimp.read(FAVICON_SOURCE);
  
  // Favicon Sizes
  console.log('Generating favicons...');
  await favicon.clone().resize(16, 16).writeAsync(path.join(SITE_ROOT, 'favicon-16x16.png'));
  await favicon.clone().resize(32, 32).writeAsync(path.join(SITE_ROOT, 'favicon-32x32.png'));
  await favicon.clone().resize(180, 180).writeAsync(path.join(SITE_ROOT, 'apple-touch-icon.png'));
  await favicon.clone().resize(192, 192).writeAsync(path.join(SITE_ROOT, 'android-chrome-192x192.png'));
  await favicon.clone().resize(512, 512).writeAsync(path.join(SITE_ROOT, 'android-chrome-512x512.png'));

  console.log('Generating logo variants...');
  // Optional: Generate a mobile specific logo if needed, but CSS is usually preferred.
  // We will generate a specific "mobile" optimized logo just in case we need it for specific media queries
  // shrinking it to max 200px width.
  const logo = await Jimp.read(LOGO_SOURCE);
  await logo.clone().resize(200, Jimp.AUTO).writeAsync(path.join(SITE_ROOT, 'logo_header_mobile.png'));

  console.log('Done.');
}

resize().catch(err => {
  console.error(err);
  process.exit(1);
});
