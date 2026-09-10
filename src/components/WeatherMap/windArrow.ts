/** Arrow drawn once and reused as a map icon, pointing north before rotation. */
export const arrowWidth = 26;
export const arrowHeight = 58;

export function windArrowImage(pixelRatio = 2): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = arrowWidth * pixelRatio;
  canvas.height = arrowHeight * pixelRatio;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('風向の矢印を描画できません。');
  context.scale(pixelRatio, pixelRatio);
  const centre = arrowWidth / 2;
  const head = 19;
  const shaft = 2.6;
  const arrow = new Path2D();
  arrow.moveTo(centre, 2);
  arrow.lineTo(centre + 8.5, head);
  arrow.lineTo(centre + shaft, head);
  arrow.lineTo(centre + shaft, arrowHeight - 2);
  arrow.lineTo(centre - shaft, arrowHeight - 2);
  arrow.lineTo(centre - shaft, head);
  arrow.lineTo(centre - 8.5, head);
  arrow.closePath();
  // A white edge keeps the arrow readable over both land and sea.
  context.lineJoin = 'round';
  context.lineWidth = 3;
  context.strokeStyle = '#ffffff';
  context.stroke(arrow);
  context.fillStyle = '#123b52';
  context.fill(arrow);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
