/**
 * Convert stored image URLs into URLs that can be loaded by an https site.
 * Older rows may contain an http Cloudinary URL or an empty value.
 */
function normalizePhotoUrl(candidate: string | null | undefined): string | null {
  const value = candidate?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
    }

    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Add a browser-friendly transformation to an existing Cloudinary URL.
 * This keeps the stored version/public ID, while converting HEIC to JPEG/WebP.
 */
export function getCloudinaryDisplayUrl(urlValue: string | null | undefined): string | null {
  const normalized = normalizePhotoUrl(urlValue);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.hostname !== 'res.cloudinary.com') return null;

    const uploadMarker = '/image/upload/';
    const uploadIndex = url.pathname.indexOf(uploadMarker);
    if (uploadIndex < 0) return null;

    // Keep only the version and asset path. This removes upload-time delivery
    // transformations such as c_fill, w_*, and h_* that can force every card
    // into the same cropped aspect ratio.
    const pathAfterUpload = url.pathname.slice(uploadIndex + uploadMarker.length);
    const pathSegments = pathAfterUpload.split('/').filter(Boolean);
    const versionIndex = pathSegments.findIndex((segment) => /^v\\d+$/.test(segment));
    const assetPath = versionIndex >= 0
      ? pathSegments.slice(versionIndex).join('/')
      : pathSegments[pathSegments.length - 1];

    if (!assetPath) return null;

    url.pathname = `${url.pathname.slice(0, uploadIndex + uploadMarker.length)}f_auto,q_auto/${assetPath}`;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Build a browser-friendly Cloudinary delivery URL from a stored public ID.
 * `f_auto` converts formats such as HEIC to one the current browser supports;
 * `q_auto` keeps the generated preview reasonably small.
 */
export function getCloudinaryPhotoUrl(publicId: string | null | undefined): string | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const value = publicId?.trim();
  if (!cloudName || !value) return null;

  const encodedPublicId = value.split('/').map(encodeURIComponent).join('/');
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/f_auto,q_auto/${encodedPublicId}`;
}

/** Return unique usable image URLs in fallback order. */
export function getPhotoUrls(
  ...candidates: Array<string | null | undefined>
): string[] {
  return Array.from(
    new Set(candidates.map(normalizePhotoUrl).filter((url): url is string => Boolean(url))),
  );
}

/** Return the first usable image URL in fallback order. */
export function getPhotoUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  return getPhotoUrls(...candidates)[0] ?? null;
}
