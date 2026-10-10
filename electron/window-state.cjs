/** Native geometry stays separate from renderer-owned preferences. */
function sanitizeWindowState(value) {
  if (!value || typeof value !== "object") return null;
  if (!Number.isFinite(value.width) || !Number.isFinite(value.height)) return null;
  if (value.width < 200 || value.height < 200) return null;
  return {
    width: Math.round(value.width),
    height: Math.round(value.height),
    maximized: value.maximized === true,
  };
}

function readWindowState(json) {
  try {
    return sanitizeWindowState(JSON.parse(json || "{}").windowState);
  } catch {
    return null;
  }
}

function windowSize(state, area) {
  const minWidth = Math.min(1024, area.width);
  const minHeight = Math.min(680, area.height);
  return {
    width: Math.min(area.width, Math.max(minWidth, state?.width ?? 1520)),
    height: Math.min(area.height, Math.max(minHeight, state?.height ?? 920)),
    minWidth,
    minHeight,
  };
}

function mergeWindowState(json, state) {
  const data = JSON.parse(json || "{}");
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid settings");
  const valid = sanitizeWindowState(state);
  if (valid) data.windowState = valid;
  return JSON.stringify(data, null, 2);
}

module.exports = { sanitizeWindowState, readWindowState, windowSize, mergeWindowState };
