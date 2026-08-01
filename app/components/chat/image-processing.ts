"use client";

const MAX_IMAGE_SIDE = 1080;
const IMAGE_QUALITY = 0.84;
const MAX_MESSAGE_IMAGE_BYTES = 420 * 1024;
const IMAGE_QUALITY_STEPS = [IMAGE_QUALITY, 0.72, 0.6, 0.48, 0.36, 0.26, 0.18, 0.12, 0.08];

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
};

export async function resizeMessageImageTo1080p(file: File): Promise<string> {
  const resizedFile = await prepareImageFileTo1080p(file);
  return readFileAsDataUrl(resizedFile);
}

export async function prepareImageFileTo1080p(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  const image = await loadImage(file);
  try {
    const size = get1080pSize(image.width, image.height);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) throw new Error("Image could not be processed.");

    canvas.width = size.width;
    canvas.height = size.height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image.source, 0, 0, size.width, size.height);
    // JPEG encoding is supported consistently across Safari and other mobile
    // browsers. Unsupported WebP canvas encoding may silently fall back to a
    // large PNG and bypass every quality step below.
    const outputType = "image/jpeg";
    const blob = await canvasToMessageBlob(canvas, outputType);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";

    return new File([blob], `${baseName}-1080p.jpg`, {
      type: outputType,
      lastModified: Date.now()
    });
  } finally {
    image.close?.();
  }
}

function get1080pSize(width: number, height: number) {
  const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

async function loadImage(file: File): Promise<LoadedImage> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close()
    };
  }

  const dataUrl = await readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight
      });
    };
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Image compression failed.")),
      type,
      quality
    );
  });
}

async function canvasToMessageBlob(canvas: HTMLCanvasElement, type: string) {
  let smallestBlob: Blob | null = null;

  for (const quality of IMAGE_QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, type, quality);
    smallestBlob = blob;
    if (blob.size <= MAX_MESSAGE_IMAGE_BYTES) return blob;
  }

  if (smallestBlob) {
    throw new Error("Image could not be compressed below the upload limit.");
  }
  throw new Error("Image compression failed.");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}
