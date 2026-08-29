import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markPath = path.join(root, "public", "maskines-brand-mark-v3.png");
const outputPath = path.join(root, "public", "maskines-email-brand-light-v3.png");

const wordmark = Buffer.from(`
  <svg width="560" height="67" viewBox="0 0 438 52" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 52V0h11.4l14.6 20L40.6 0H52v52H40.4V19.2L27.3 37.5h-2.6L11.6 19.2V52H0Z" fill="#172431"/>
    <path d="M55 52 80.3 0h8.4L114 52H99.6L84.5 18.2 69.4 52H55Z" fill="#ff7417"/>
    <path d="M120 52V40.6h32.3c3.2 0 5.2-1.5 5.2-4.1 0-2.3-1.4-3.7-4.4-3.7h-20.2c-9.3 0-14.4-5.1-14.4-15.5C118.5 6.3 124.6 0 135.1 0h33.4v11.4h-31.6c-3.4 0-5.3 1.8-5.3 4.5 0 2.7 1.8 4.2 5.3 4.2h19.6c9.3 0 14.3 5.2 14.3 15.5 0 10.3-5.9 16.4-17.3 16.4H120Z" fill="#172431"/>
    <path d="M180 52V0h12.3v20.8L215.1 0H231l-23.4 25.4L232 52h-16.2l-19.1-21.1-4.4 4.7V52H180Z" fill="#172431"/>
    <path d="M240 52V0h12.4v52H240Z" fill="#172431"/>
    <path d="M264 52V0h11.2l29.2 31.4V0H317v52h-10.8L276.6 20v32H264Z" fill="#172431"/>
    <path d="M329 0h47v10.5h-47V0Zm0 20.8h47v10.5h-47V20.8Zm0 20.7h47V52h-47V41.5Z" fill="#ff7417"/>
    <path d="M383 52V40.6h32.3c3.2 0 5.2-1.5 5.2-4.1 0-2.3-1.4-3.7-4.4-3.7h-20.2c-9.3 0-14.4-5.1-14.4-15.5C381.5 6.3 387.6 0 398.1 0h33.4v11.4h-31.6c-3.4 0-5.3 1.8-5.3 4.5 0 2.7 1.8 4.2 5.3 4.2h19.6c9.3 0 14.3 5.2 14.3 15.5 0 10.3-5.9 16.4-17.3 16.4H383Z" fill="#172431"/>
  </svg>
`);

const mark = await sharp(markPath)
  .resize({
    width: 170,
    height: 145,
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 800,
    height: 200,
    channels: 4,
    background: "#ffffff"
  }
})
  .composite([
    { input: mark, left: 25, top: 28 },
    { input: wordmark, left: 215, top: 67 }
  ])
  .png()
  .toFile(outputPath);

console.log(`Generated ${outputPath}`);
