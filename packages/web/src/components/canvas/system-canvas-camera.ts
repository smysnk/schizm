export type SystemCanvasViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SystemCanvasViewport = {
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const screenToSystemCanvasWorld = (
  viewBox: SystemCanvasViewBox,
  viewport: SystemCanvasViewport,
  screenX: number,
  screenY: number
) => ({
  x: viewBox.x + (screenX / Math.max(viewport.width, 1)) * viewBox.width,
  y: viewBox.y + (screenY / Math.max(viewport.height, 1)) * viewBox.height
});

export const panSystemCanvasViewBox = (
  viewBox: SystemCanvasViewBox,
  viewport: SystemCanvasViewport,
  deltaX: number,
  deltaY: number
): SystemCanvasViewBox => ({
  ...viewBox,
  x: viewBox.x - (deltaX / Math.max(viewport.width, 1)) * viewBox.width,
  y: viewBox.y - (deltaY / Math.max(viewport.height, 1)) * viewBox.height
});

export const zoomSystemCanvasViewBoxAtPoint = (
  viewBox: SystemCanvasViewBox,
  viewport: SystemCanvasViewport,
  screenX: number,
  screenY: number,
  scaleDelta: number,
  {
    minZoomIn = 0.35,
    maxZoomOut = 3
  }: {
    minZoomIn?: number;
    maxZoomOut?: number;
  } = {}
): SystemCanvasViewBox => {
  const widthFactor = clamp(scaleDelta, minZoomIn, maxZoomOut);
  const nextWidth = viewBox.width * widthFactor;
  const nextHeight = viewBox.height * widthFactor;
  const ratioX = screenX / Math.max(viewport.width, 1);
  const ratioY = screenY / Math.max(viewport.height, 1);
  const anchor = screenToSystemCanvasWorld(viewBox, viewport, screenX, screenY);

  return {
    x: anchor.x - ratioX * nextWidth,
    y: anchor.y - ratioY * nextHeight,
    width: nextWidth,
    height: nextHeight
  };
};
