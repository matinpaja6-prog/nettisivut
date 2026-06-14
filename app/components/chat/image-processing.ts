"use client";

const JPEG_QUALITY = 0.86;

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
};

export async function resizeMessageImageTo1080p(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  try {
    const image = await loadImage(file);
    const size = get1080pSize(image.width, image.height);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      image.close?.();
      return readFileAsDataUrl(file);
    }

    canvas.width = size.width;
    canvas.height = size.height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, size.width, size.height);
    image.close?.();

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return readFileAsDataUrl(file);
  }
}

function get1080pSize(width: number, height: number) {
  const limits =
    width > height
      ? { width: 1920, height: 1080 }
      : height > width
        ? { width: 1080, height: 1920 }
        : { width: 1080, height: 1080 };
  const ratio = Math.min(1, limits.width / width, limits.height / height);

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

async function loadImage(file: File): Promise<LoadedImage> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}
