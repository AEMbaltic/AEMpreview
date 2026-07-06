#!/usr/bin/env node
// Split a video into scroll-scrub frames for the site.
//
// Usage:
//   npm run frames -- videos/hero.mp4 scene-1
//   npm run frames -- videos/hero.mp4 scene-1 --fps 24 --quality 78
//
// Output:
//   public/frames/scene-1/desktop/frame-0001.webp  (1920px wide)
//   public/frames/scene-1/mobile/frame-0001.webp   (900px wide, center-cropped 9:16)
//   public/frames/scene-1/manifest.json
//
// Keep source clips ~8–15s. At 24fps that is ~200–360 frames per scene,
// which scrubs smoothly without a huge download.

import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

// Prefer system ffmpeg; fall back to the optional ffmpeg-static package.
async function resolveFfmpeg() {
  try {
    const p = execSync('which ffmpeg', { encoding: 'utf8' }).trim();
    if (p) return p;
  } catch {
    /* not on PATH */
  }
  try {
    return (await import('ffmpeg-static')).default;
  } catch {
    return null;
  }
}
const ffmpegPath = await resolveFfmpeg();
if (!ffmpegPath) {
  console.error('ffmpeg not found. Install it (apt install ffmpeg / brew install ffmpeg) or `npm i -D ffmpeg-static`.');
  process.exit(1);
}

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : def;
};

const [videoPath, sceneId] = positional;
if (!videoPath || !sceneId) {
  console.error('Usage: npm run frames -- <video-file> <scene-id> [--fps 24] [--quality 78]');
  process.exit(1);
}
if (!existsSync(videoPath)) {
  console.error(`Video not found: ${videoPath}`);
  process.exit(1);
}

const fps = Number(flag('fps', 24));
const quality = Number(flag('quality', 78));
const outRoot = path.join('public', 'frames', sceneId);

const variants = [
  // Desktop: fit within 1920 wide, keep aspect.
  { name: 'desktop', filter: `fps=${fps},scale=1920:-2:flags=lanczos` },
  // Mobile: center-crop to 9:16 portrait, 900px wide.
  { name: 'mobile', filter: `fps=${fps},crop=ih*9/16:ih,scale=900:-2:flags=lanczos` },
];

for (const v of variants) {
  const dir = path.join(outRoot, v.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  console.log(`Extracting ${v.name} frames…`);
  execFileSync(
    ffmpegPath,
    [
      '-i', videoPath,
      '-vf', v.filter,
      '-c:v', 'libwebp',
      '-quality', String(quality),
      '-y',
      path.join(dir, 'frame-%04d.webp'),
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
}

const desktopFrames = readdirSync(path.join(outRoot, 'desktop')).filter((f) => f.endsWith('.webp'));
const mobileFrames = readdirSync(path.join(outRoot, 'mobile')).filter((f) => f.endsWith('.webp'));
const frameCount = Math.min(desktopFrames.length, mobileFrames.length);

writeFileSync(
  path.join(outRoot, 'manifest.json'),
  JSON.stringify({ frameCount, fps, ext: 'webp' }, null, 2)
);

console.log(`\n✔ ${sceneId}: ${frameCount} frames (desktop ${desktopFrames.length}, mobile ${mobileFrames.length})`);
console.log(`  Manifest: ${path.join(outRoot, 'manifest.json')}`);
if (frameCount > 450) {
  console.warn('  ⚠ Over 450 frames — consider a shorter clip or lower --fps to keep the page fast.');
}
