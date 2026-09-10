import { addProtocol } from 'maplibre-gl';

/**
 * JMA publishes precipitation tiles only at even zoom levels. Odd levels answer
 * HTTP 200 with a transparent image, so the layer would blank out at those
 * zooms while the base map keeps drawing. Requests for a missing level are
 * served from the nearest lower level instead, cropped to the requested tile.
 */
export const rainTileScheme = 'jma-rain';
const nativeZooms = [4, 6, 8, 10];
const tileSize = 256;

export function nativeZoomFor(zoom: number): number {
  let native = nativeZooms[0];
  for (const level of nativeZooms) if (level <= zoom) native = level;
  return native;
}

export type RainTileRequest = { source: string; delta: number; x: number; y: number };

/** Rewrite a tile request onto the nearest published zoom level. */
export function resolveRainTile(url: string): RainTileRequest {
  const parts = url.replace(rainTileScheme + '://', '').split('/');
  const y = Number(parts.pop()?.replace('.png', ''));
  const x = Number(parts.pop());
  const z = Number(parts.pop());
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error('降水タイルの要求を解釈できません。');
  }
  const delta = Math.max(0, z - nativeZoomFor(z));
  return { source: [...parts, z - delta, x >> delta, y >> delta].join('/') + '.png', delta, x, y };
}

async function crop(blob: Blob, { delta, x, y }: RainTileRequest): Promise<ArrayBuffer> {
  const span = 2 ** delta;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = tileSize;
  canvas.height = tileSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('降水タイルを描画できません。');
  const part = bitmap.width / span;
  context.drawImage(bitmap, (x % span) * part, (y % span) * part, part, part, 0, 0, tileSize, tileSize);
  bitmap.close();
  const cropped = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!cropped) throw new Error('降水タイルを生成できません。');
  return cropped.arrayBuffer();
}

let registered = false;
export function registerRainTileProtocol() {
  if (registered) return;
  registered = true;
  addProtocol(rainTileScheme, async (params, abortController) => {
    const request = resolveRainTile(params.url);
    const response = await fetch(request.source, { signal: abortController.signal });
    if (!response.ok) throw new Error('降水タイルを取得できません（HTTP ' + response.status + '）。');
    const blob = await response.blob();
    return { data: request.delta === 0 ? await blob.arrayBuffer() : await crop(blob, request) };
  });
}
