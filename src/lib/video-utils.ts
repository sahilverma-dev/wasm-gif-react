export async function getMetadata(
  file: File
): Promise<{
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      // Seek to 0.5s or 10% to avoid black frame if starts black
      video.currentTime = Math.min(0.5, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight,
                thumbnailUrl: URL.createObjectURL(blob),
              });
            } else {
              reject(new Error("Thumbnail generation failed"));
            }
            // Cleanup
            URL.revokeObjectURL(video.src);
          },
          "image/jpeg",
          0.7
        );
      } else {
        reject(new Error("Canvas context failed"));
      }
    };

    video.onerror = () => {
      reject(new Error("Failed to load video"));
    };
  });
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}
