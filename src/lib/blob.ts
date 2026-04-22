/**
 * Object URLs are the main source of memory growth in this app: every video,
 * thumbnail and generated GIF owns one. These helpers keep the pairing of
 * create/revoke in one place so none of them leak.
 */

export function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function releaseObjectUrl(url?: string | null): void {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
