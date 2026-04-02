/**
 * Shared helpers for post image/video rendering (PostView, PostTile, etc.).
 */

export function postRendersAsVideo(postType) {
  // Current mapping: shorts are always video; other types may change later.
  return Number(postType) === 3 || Number(postType) === 2;
}

export function postRendersAsImage(postType) {
  return Number(postType) === 1
}

export function isVideoMime(contentType) {
  return typeof contentType === 'string' && contentType.startsWith('video/')
}

export function isImageMime(contentType) {
  return typeof contentType === 'string' && contentType.startsWith('image/')
}

/** Taller than 1:3 portrait (width:height) → crop; CSS aspect-ratio = width/height, min 1/3 */
export const TILE_ASPECT_RATIO_MIN = 1 / 3
/** Wider than 3:1 landscape → crop */
export const TILE_ASPECT_RATIO_MAX = 3

/**
 * Tile box uses intrinsic media aspect ratio when possible.
 * Clamps to [1/3, 3]: beyond 1:3 portrait or 3:1 landscape, use `object-cover object-center` on the media.
 *
 * @param {number} intrinsicWidth
 * @param {number} intrinsicHeight
 * @returns {number} width/height for CSS `aspect-ratio`
 */
export function clampTileAspectRatio(intrinsicWidth, intrinsicHeight) {
  if (
    typeof intrinsicWidth !== 'number' ||
    typeof intrinsicHeight !== 'number' ||
    intrinsicWidth <= 0 ||
    intrinsicHeight <= 0
  ) {
    return 1
  }
  const r = intrinsicWidth / intrinsicHeight
  return Math.max(TILE_ASPECT_RATIO_MIN, Math.min(TILE_ASPECT_RATIO_MAX, r))
}
