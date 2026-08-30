import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const ORANGE = "#ff7417";
const NAVY = "#172433";

async function vectorMark(primary, output) {
  const source = Buffer.from(`<svg width="512" height="401" viewBox="0 0 512 401" xmlns="http://www.w3.org/2000/svg">
    <path fill="${primary}" d="M27 8 255 183v53L66 92v157l94 123L27 261Z"/>
    <path fill="${ORANGE}" d="M485 8 263 183v53L447 92v157l-94 123 132-111Z"/>
    <path fill="${primary}" d="m104 185 103 76-62-11-29-18Z"/>
    <path fill="${primary}" d="m408 185-103 76 62-11 29-18Z"/>
    <path fill="${primary}" d="m207 258 47 34v100l-33-24Z"/>
    <path fill="${ORANGE}" d="m305 258-42 34v100l29-27Z"/>
  </svg>`);
  const buffer = await sharp(source).png().toBuffer();
  await sharp(buffer).png().toFile(output);
  return buffer;
}

const wordmarkPaths = `
  <path d="M0 52V0h11.4l14.6 20L40.6 0H52v52H40.4V19.2L27.3 37.5h-2.6L11.6 19.2V52H0Z"/>
  <path d="M55 52 80.3 0h8.4L114 52H99.6L84.5 18.2 69.4 52H55Z" fill="#ff7417"/>
  <path d="M120 52V40.6h32.3c3.2 0 5.2-1.5 5.2-4.1 0-2.3-1.4-3.7-4.4-3.7h-20.2c-9.3 0-14.4-5.1-14.4-15.5C118.5 6.3 124.6 0 135.1 0h33.4v11.4h-31.6c-3.4 0-5.3 1.8-5.3 4.5 0 2.7 1.8 4.2 5.3 4.2h19.6c9.3 0 14.3 5.2 14.3 15.5 0 10.3-5.9 16.4-17.3 16.4H120Z"/>
  <path d="M180 52V0h12.3v20.8L215.1 0H231l-23.4 25.4L232 52h-16.2l-19.1-21.1-4.4 4.7V52H180Z"/>
  <path d="M240 52V0h12.4v52H240Z"/>
  <path d="M264 52V0h11.2l29.2 31.4V0H317v52h-10.8L276.6 20v32H264Z"/>
  <path d="M329 0h47v10.5h-47V0Zm0 20.8h47v10.5h-47V20.8Zm0 20.7h47V52h-47V41.5Z" fill="#ff7417"/>
  <path d="M383 52V40.6h32.3c3.2 0 5.2-1.5 5.2-4.1 0-2.3-1.4-3.7-4.4-3.7h-20.2c-9.3 0-14.4-5.1-14.4-15.5C381.5 6.3 387.6 0 398.1 0h33.4v11.4h-31.6c-3.4 0-5.3 1.8-5.3 4.5 0 2.7 1.8 4.2 5.3 4.2h19.6c9.3 0 14.3 5.2 14.3 15.5 0 10.3-5.9 16.4-17.3 16.4H383Z"/>
`;

const lightMark = await vectorMark(
  NAVY,
  "public/maskines-brand-mark-clean-v4.png",
);
const darkMark = await vectorMark(
  "#ffffff",
  "public/maskines-brand-mark-dark-clean-v4.png",
);

async function squareFavicon(mark) {
  const centeredMark = await sharp(mark)
    .resize({ width: 448, height: 350, fit: "contain" })
    .png()
    .toBuffer();
  const favicon512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: centeredMark, left: 32, top: 81 }])
    .png()
    .toBuffer();

  await writeFile("public/maskines-favicon-v5.png", favicon512);

  const favicon48 = await sharp(favicon512).resize(48, 48).png().toBuffer();
  const favicon256 = await sharp(favicon512).resize(256, 256).png().toBuffer();
  const images = [favicon48, favicon256];
  const headerSize = 6 + images.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize;
  images.forEach((image, index) => {
    const size = index === 0 ? 48 : 256;
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });

  await writeFile("public/favicon.ico", Buffer.concat([header, ...images]));
}

await squareFavicon(lightMark);

async function fullLogo(mark, foreground, background, output) {
  const resizedMark = await sharp(mark).resize({ width: 204, height: 160, fit: "contain" }).png().toBuffer();
  const wordmark = Buffer.from(
    `<svg width="630" height="75" viewBox="0 0 438 52" xmlns="http://www.w3.org/2000/svg" fill="${foreground}">${wordmarkPaths}</svg>`
  );
  await sharp({
    create: { width: 900, height: 220, channels: 4, background }
  }).composite([
    { input: resizedMark, left: 20, top: 30 },
    { input: wordmark, left: 250, top: 73 }
  ]).png().toFile(output);
}

await fullLogo(
  lightMark,
  "#172433",
  { r: 255, g: 255, b: 255, alpha: 1 },
  "public/maskines-email-brand-light-clean-v4.png"
);
await fullLogo(
  darkMark,
  "#ffffff",
  { r: 32, g: 33, b: 36, alpha: 1 },
  "public/maskines-email-brand-dark-clean-v4.png"
);
