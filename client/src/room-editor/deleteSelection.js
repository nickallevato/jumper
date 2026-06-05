const COLLECTION_KEY_BY_TYPE = {
  platform: 'platforms',
  hidden: 'hidden',
  portal: 'portals',
}

function selectedIndexIn(collection, selected) {
  if (
    Number.isInteger(selected.index) &&
    collection[selected.index]?.tx === selected.tx &&
    collection[selected.index]?.ty === selected.ty
  ) {
    return selected.index
  }
  return collection.findIndex(item => item.tx === selected.tx && item.ty === selected.ty)
}

export function deleteSelectedFromRoom(room, selected) {
  if (!room || !selected) return false

  if (selected.type === 'tile') {
    if (!room.grid?.[selected.ty]?.[selected.tx]) return false
    room.grid[selected.ty][selected.tx] = 1
    room.wallTiles = (room.wallTiles ?? []).filter(([wx, wy]) => wx !== selected.tx || wy !== selected.ty)
    return true
  }

  const key = COLLECTION_KEY_BY_TYPE[selected.type]
  if (!key || !Array.isArray(room[key])) return false

  const index = selectedIndexIn(room[key], selected)
  if (index < 0) return false

  room[key].splice(index, 1)
  return true
}
