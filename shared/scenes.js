// Only local images within a work folder can be displayed, including restored history.
export function isSceneImage(scene) {
  return scene && typeof scene.image === 'string' && /^images\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif|svg)$/i.test(scene.image) && typeof scene.caption === 'string';
}
export function matchScene(scenes, text) {
  if (!Array.isArray(scenes) || typeof text !== 'string') return null;
  const normalize = value => value.normalize('NFC').replace(/\s+/g, '').toLowerCase();
  const input = normalize(text);
  const scene = scenes.find(s => s.enabled !== false && isSceneImage(s) && Array.isArray(s.keywords) && s.keywords.some(k => typeof k === 'string' && k.trim() && input.includes(normalize(k))));
  return scene ? {image:scene.image, caption:scene.caption} : null;
}
