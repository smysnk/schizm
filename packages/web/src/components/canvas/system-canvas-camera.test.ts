import assert from "node:assert/strict";
import test from "node:test";
import {
  panSystemCanvasViewBox,
  screenToSystemCanvasWorld,
  zoomSystemCanvasViewBoxAtPoint,
  type SystemCanvasViewBox,
  type SystemCanvasViewport
} from "./system-canvas-camera";

const viewBox: SystemCanvasViewBox = {
  x: 0,
  y: 0,
  width: 1000,
  height: 800
};

const viewport: SystemCanvasViewport = {
  width: 500,
  height: 400
};

test("screenToSystemCanvasWorld maps screen coordinates into the viewBox", () => {
  const world = screenToSystemCanvasWorld(viewBox, viewport, 250, 200);

  assert.equal(world.x, 500);
  assert.equal(world.y, 400);
});

test("panSystemCanvasViewBox converts drag movement into world-space translation", () => {
  const nextViewBox = panSystemCanvasViewBox(viewBox, viewport, 50, -40);

  assert.equal(nextViewBox.x, -100);
  assert.equal(nextViewBox.y, 80);
  assert.equal(nextViewBox.width, viewBox.width);
  assert.equal(nextViewBox.height, viewBox.height);
});

test("zoomSystemCanvasViewBoxAtPoint preserves the world point under the cursor", () => {
  const pointer = { x: 125, y: 80 };
  const before = screenToSystemCanvasWorld(viewBox, viewport, pointer.x, pointer.y);
  const nextViewBox = zoomSystemCanvasViewBoxAtPoint(viewBox, viewport, pointer.x, pointer.y, 0.8);
  const after = screenToSystemCanvasWorld(nextViewBox, viewport, pointer.x, pointer.y);

  assert.ok(Math.abs(before.x - after.x) < 0.0001);
  assert.ok(Math.abs(before.y - after.y) < 0.0001);
  assert.equal(nextViewBox.width, 800);
  assert.equal(nextViewBox.height, 640);
});
