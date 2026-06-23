import p5 from "p5";

const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const cache = new Map<string, p5.Image>();

function spriteUrl(id: number, facing: "front" | "back"): string {
  return facing === "front" ? `${SPRITE_BASE}/${id}.png` : `${SPRITE_BASE}/back/${id}.png`;
}

/** Load a battle sprite, returning a cached image if already loaded. */
export function loadSprite(
  p: p5,
  id: number,
  facing: "front" | "back" = "front",
): p5.Image {
  const key = `${id}:${facing}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const img = p.loadImage(spriteUrl(id, facing));
  cache.set(key, img);
  return img;
}

/** Preload front and back sprites for a list of Pokedex IDs. */
export function preloadSprites(
  p: p5,
  ids: number[],
): Map<number, { front: p5.Image; back: p5.Image }> {
  const sprites = new Map<number, { front: p5.Image; back: p5.Image }>();
  for (const id of ids) {
    sprites.set(id, {
      front: loadSprite(p, id, "front"),
      back: loadSprite(p, id, "back"),
    });
  }
  return sprites;
}
