import sharp from "sharp";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../design-mockups/brand/maskines-logo-source.png", import.meta.url));
const output = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

const sourceImage = sharp(source);
const metadata = await sourceImage.metadata();
if (metadata.width !== 1254 || metadata.height !== 1254) {
  throw new Error(`Unexpected source logo size: ${metadata.width}x${metadata.height}`);
}

const transparentBlack = async (buffer, darkInk = false) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const brightness = Math.max(red, green, blue);
    const alpha = Math.max(0, Math.min(255, Math.round((brightness - 3) * 24)));

    if (darkInk && red > 180 && green > 180 && blue > 180) {
      data[index] = 23;
      data[index + 1] = 36;
      data[index + 2] = 49;
    }
    data[index + 3] = alpha;
  }

  return sharp(data, { raw: info }).png().toBuffer();
};

const markSource = await sharp(source)
  .extract({ left: 270, top: 245, width: 715, height: 560 })
  .png()
  .toBuffer();
const wordmarkSource = await sharp(source)
  .extract({ left: 115, top: 850, width: 1025, height: 125 })
  .png()
  .toBuffer();

const markDark = await transparentBlack(markSource);
const markLight = await transparentBlack(markSource, true);
const wordmarkDark = await transparentBlack(wordmarkSource);

await sharp(markLight).resize(512, 401, { fit: "contain" }).png().toFile(output("maskines-brand-mark-v3.png"));
await sharp(markDark).resize(512, 401, { fit: "contain" }).png().toFile(output("maskines-brand-mark-dark-v3.png"));

const emailMark = await sharp(markDark).resize(220, 172, { fit: "contain" }).png().toBuffer();
const emailWordmark = await sharp(wordmarkDark).resize(610, 74, { fit: "contain" }).png().toBuffer();
await sharp({
  create: { width: 900, height: 220, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
  .composite([
    { input: emailMark, left: 10, top: 24 },
    { input: emailWordmark, left: 255, top: 73 }
  ])
  .png()
  .toFile(output("maskines-email-brand-v2.png"));

await sharp(source).resize(512, 512).png().toFile(output("maskines-icon-v2.png"));
await sharp(source).resize(1200, 1200).png().toFile(output("maskines-brand-share-v2.png"));
