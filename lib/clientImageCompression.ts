"use client";

import { IMAGE_COMPRESSION_MAX_DIMENSION } from "@/lib/mediaLimits";

type CompressImageOptions = {
  maxBytes: number;
  maxDimension?: number;
};

type LoadedImage = {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup: () => void;
};

export type CompressImageResult = {
  file: File;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
};

const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const QUALITY_STEPS = [0.78, 0.68, 0.58, 0.5];
const DIMENSION_STEPS = [1, 0.86, 0.72, 0.6];

export const isCompressibleImageFile = (file: File) => COMPRESSIBLE_IMAGE_TYPES.has(file.type.toLowerCase());

const toWebpName = (fileName: string) => {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return `${withoutExtension || "image"}.webp`;
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });

const loadImage = async (file: File): Promise<LoadedImage> => {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
      cleanup: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Unable to prepare image for upload."));
    element.src = url;
  });

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    draw: (context, width, height) => context.drawImage(image, 0, 0, width, height),
    cleanup: () => URL.revokeObjectURL(url),
  };
};

export const compressImageFile = async (
  file: File,
  { maxBytes, maxDimension = IMAGE_COMPRESSION_MAX_DIMENSION }: CompressImageOptions
): Promise<CompressImageResult> => {
  if (!isCompressibleImageFile(file) || typeof window === "undefined" || typeof document === "undefined") {
    return { file, compressed: false, originalSize: file.size, finalSize: file.size };
  }

  let source: LoadedImage | null = null;
  try {
    source = await loadImage(file);
    if (!source.width || !source.height) {
      return { file, compressed: false, originalSize: file.size, finalSize: file.size };
    }

    let bestBlob: Blob | null = null;

    for (const dimensionFactor of DIMENSION_STEPS) {
      const targetMaxDimension = Math.max(640, Math.round(maxDimension * dimensionFactor));
      const scale = Math.min(1, targetMaxDimension / Math.max(source.width, source.height));
      const width = Math.max(1, Math.round(source.width * scale));
      const height = Math.max(1, Math.round(source.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) continue;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      source.draw(context, width, height);

      for (const quality of QUALITY_STEPS) {
        const blob = await canvasToBlob(canvas, quality);
        if (!blob) continue;
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
        if (blob.size <= maxBytes) {
          const nextFile = new File([blob], toWebpName(file.name), {
            type: "image/webp",
            lastModified: file.lastModified,
          });
          return {
            file: nextFile,
            compressed: nextFile.size < file.size || file.type !== nextFile.type,
            originalSize: file.size,
            finalSize: nextFile.size,
          };
        }
      }
    }

    if (bestBlob && bestBlob.size < file.size) {
      const nextFile = new File([bestBlob], toWebpName(file.name), {
        type: "image/webp",
        lastModified: file.lastModified,
      });
      return {
        file: nextFile,
        compressed: true,
        originalSize: file.size,
        finalSize: nextFile.size,
      };
    }
  } catch {
    return { file, compressed: false, originalSize: file.size, finalSize: file.size };
  } finally {
    source?.cleanup();
  }

  return { file, compressed: false, originalSize: file.size, finalSize: file.size };
};
