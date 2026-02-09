// Image Processing Utilities for HTML Documents
// 이미지를 추출, Base64 변환, 저장 및 복원

import type { LocalStorageManager } from './LocalStorageManager';

/**
 * HTML에서 모든 이미지 추출
 */
export async function extractImagesFromHTML(
  html: string,
  storageManager: LocalStorageManager
): Promise<{ processedHTML: string; imageCount: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img');

  let imageCount = 0;

  for (const img of Array.from(images)) {
    const src = img.getAttribute('src');
    if (!src) continue;

    try {
      // 1. 이미 Base64인 경우 스킵
      if (src.startsWith('data:image')) {
        imageCount++;
        continue;
      }

      // 2. 상대 경로 또는 로컬 경로 처리
      let imageBlob: Blob | null = null;

      if (src.startsWith('http://') || src.startsWith('https://')) {
        // 외부 URL: fetch로 가져오기
        try {
          const response = await fetch(src);
          if (response.ok) {
            imageBlob = await response.blob();
          }
        } catch (e) {
          console.warn(`Failed to fetch image: ${src}`, e);
        }
      } else {
        // 로컬 파일: File API로 변환 (브라우저에서는 제한적)
        // 대부분의 경우 Base64로 이미 인코딩되어 있거나, 사용자가 업로드한 HTML이므로 경로가 유효하지 않을 수 있음
        console.warn(`Local image path detected (may not load): ${src}`);
      }

      if (imageBlob) {
        // 3. 이미지를 저장소에 저장
        const filename = `img-${Date.now()}-${imageCount}.${getImageExtension(imageBlob.type)}`;
        await storageManager.saveImage(filename, imageBlob);

        // 4. HTML에서 src를 내부 참조로 변경
        img.setAttribute('src', `storage://${filename}`);
        img.setAttribute('data-original-src', src);
        imageCount++;
      } else {
        // Base64로 변환 시도 (fallback)
        const base64 = await convertImageToBase64(src);
        if (base64) {
          img.setAttribute('src', base64);
          imageCount++;
        }
      }
    } catch (e) {
      console.error(`Failed to process image: ${src}`, e);
    }
  }

  return {
    processedHTML: doc.documentElement.outerHTML,
    imageCount
  };
}

/**
 * 이미지 확장자 추출
 */
function getImageExtension(mimeType: string): string {
  const map: { [key: string]: string } = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg'
  };
  return map[mimeType] || 'jpg';
}

/**
 * 이미지를 Base64로 변환
 */
async function convertImageToBase64(src: string): Promise<string | null> {
  try {
    // Canvas를 사용한 변환 (CORS 제한 있을 수 있음)
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        try {
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${src}`));
      };

      img.src = src;
    });
  } catch (e) {
    console.error('Image to Base64 conversion failed', e);
    return null;
  }
}

/**
 * HTML 렌더링 시 storage:// 프로토콜을 실제 이미지 URL로 복원
 */
export async function restoreImagesInHTML(
  html: string,
  storageManager: LocalStorageManager
): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img[src^="storage://"]');

  for (const img of Array.from(images)) {
    const src = img.getAttribute('src');
    if (!src) continue;

    const filename = src.replace('storage://', '');
    const imageURL = await storageManager.loadImage(filename);

    if (imageURL) {
      img.setAttribute('src', imageURL);
    } else {
      // 원본 URL로 복원 시도
      const originalSrc = img.getAttribute('data-original-src');
      if (originalSrc) {
        img.setAttribute('src', originalSrc);
      }
    }
  }

  return doc.documentElement.outerHTML;
}

/**
 * Drag & Drop된 이미지 파일 처리
 */
export async function processDroppedImages(
  files: FileList,
  storageManager: LocalStorageManager
): Promise<{ [filename: string]: string }> {
  const results: { [filename: string]: string } = {};

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;

    try {
      const filename = `upload-${Date.now()}-${file.name}`;
      await storageManager.saveImage(filename, file);

      const url = await storageManager.loadImage(filename);
      if (url) {
        results[filename] = url;
      }
    } catch (e) {
      console.error(`Failed to process dropped image: ${file.name}`, e);
    }
  }

  return results;
}

/**
 * 인라인 Base64 이미지를 추출해서 저장소로 전환 (메모리 최적화)
 */
export async function optimizeInlineImages(
  html: string,
  storageManager: LocalStorageManager
): Promise<{ processedHTML: string; optimizedCount: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img[src^="data:image"]');

  let optimizedCount = 0;

  for (const img of Array.from(images)) {
    const src = img.getAttribute('src');
    if (!src) continue;

    try {
      // Base64를 Blob으로 변환
      const blob = await (await fetch(src)).blob();
      const filename = `optimized-${Date.now()}-${optimizedCount}.${getImageExtension(blob.type)}`;

      await storageManager.saveImage(filename, blob);

      // HTML에서 참조 변경
      img.setAttribute('src', `storage://${filename}`);
      img.setAttribute('data-original-inline', 'true');
      optimizedCount++;
    } catch (e) {
      console.error('Failed to optimize inline image', e);
    }
  }

  return {
    processedHTML: doc.documentElement.outerHTML,
    optimizedCount
  };
}
