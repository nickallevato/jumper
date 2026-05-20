// Shared emote rendering: a brief bubble that floats up and fades above a player's graphic.
const EMOTES = {
  wave: '👋',
}

export function showEmoteAbove(scene, gfx, type) {
  const glyph = EMOTES[type] ?? EMOTES.wave
  const t = scene.add.text(gfx.x, gfx.y - 48, glyph, { fontSize: '24px' })
    .setOrigin(0.5)
    .setDepth(2000)
  scene.tweens.add({
    targets: t,
    y: '-=18',
    alpha: { from: 1, to: 0 },
    duration: 1200,
    ease: 'Sine.easeOut',
    onComplete: () => t.destroy(),
  })
}
