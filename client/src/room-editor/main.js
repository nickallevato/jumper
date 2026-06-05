import Phaser from 'phaser'
import {
  ROOM_CATALOG,
  exportRoomCatalogSnapshot,
  formatRoomCatalogSnapshot,
  importRoomCatalogSnapshot,
} from '../../../shared/roomCatalog.js'
import { TILE_H, TILE_W } from '../../../shared/constants.js'
import { toScreen } from '../../../shared/coordinates.js'
import './styles.css'

const TILE_COLORS = {
  1: 0x4c8b5e,
  2: 0x6272a4,
  3: 0x3b82c4,
}

const TOOL_LABELS = {
  wall: 'Wall',
  platform: 'Platform',
  hidden: 'Hidden',
  portal: 'Portal',
  spawn: 'Spawn',
}

const state = {
  catalog: exportRoomCatalogSnapshot(ROOM_CATALOG).rooms,
  roomId: 'overworld',
  tool: 'platform',
  selected: null,
}

const els = {
  roomSelect: document.querySelector('#roomSelect'),
  portalTarget: document.querySelector('#portalTarget'),
  tileType: document.querySelector('#tileType'),
  heightInput: document.querySelector('#heightInput'),
  selectionStats: document.querySelector('#selectionStats'),
  deleteSelected: document.querySelector('#deleteSelected'),
  exportCatalog: document.querySelector('#exportCatalog'),
  importCatalog: document.querySelector('#importCatalog'),
  catalogJson: document.querySelector('#catalogJson'),
  statusLine: document.querySelector('#statusLine'),
}

function currentRoom() {
  return state.catalog[state.roomId]
}

function setStatus(message) {
  els.statusLine.textContent = message
}

function setRooms(catalog) {
  state.catalog = catalog
  if (!state.catalog[state.roomId]) state.roomId = Object.keys(state.catalog)[0]
  populateRoomOptions()
  state.selected = null
}

function populateRoomOptions() {
  const roomIds = Object.keys(state.catalog)
  els.roomSelect.innerHTML = roomIds
    .map(roomId => `<option value="${roomId}">${state.catalog[roomId].name ?? roomId}</option>`)
    .join('')
  els.portalTarget.innerHTML = roomIds
    .map(roomId => `<option value="${roomId}">${state.catalog[roomId].name ?? roomId}</option>`)
    .join('')
  els.roomSelect.value = state.roomId
  els.portalTarget.value = roomIds.find(roomId => roomId !== state.roomId) ?? state.roomId
}

function objectAt(room, tx, ty) {
  const platformIndex = (room.platforms ?? []).findIndex(item => item.tx === tx && item.ty === ty)
  if (platformIndex >= 0) return { type: 'platform', index: platformIndex, item: room.platforms[platformIndex] }

  const hiddenIndex = (room.hidden ?? []).findIndex(item => item.tx === tx && item.ty === ty)
  if (hiddenIndex >= 0) return { type: 'hidden', index: hiddenIndex, item: room.hidden[hiddenIndex] }

  const portalIndex = (room.portals ?? []).findIndex(item => item.tx === tx && item.ty === ty)
  if (portalIndex >= 0) return { type: 'portal', index: portalIndex, item: room.portals[portalIndex] }

  if (room.spawn?.tx === tx && room.spawn?.ty === ty) return { type: 'spawn', item: room.spawn }

  return null
}

function upsertPositionList(room, key, tx, ty, item) {
  room[key] ??= []
  const index = room[key].findIndex(entry => entry.tx === tx && entry.ty === ty)
  if (index >= 0) room[key][index] = item
  else room[key].push(item)
  return room[key].findIndex(entry => entry.tx === tx && entry.ty === ty)
}

function removeWallTile(room, tx, ty) {
  room.wallTiles = (room.wallTiles ?? []).filter(([wx, wy]) => wx !== tx || wy !== ty)
}

function applyPlacement(tx, ty) {
  const room = currentRoom()
  if (!room.grid[ty]?.[tx]) return

  if (state.tool === 'wall') {
    const tileType = Number(els.tileType.value)
    room.grid[ty][tx] = tileType
    if (tileType === 2) {
      room.wallTiles ??= []
      if (!room.wallTiles.some(([wx, wy]) => wx === tx && wy === ty)) room.wallTiles.push([tx, ty])
    } else {
      removeWallTile(room, tx, ty)
    }
    state.selected = { type: 'tile', tx, ty, item: { tile: tileType } }
  } else if (state.tool === 'platform') {
    const item = { tx, ty, tz: Number(els.heightInput.value) || 0 }
    const index = upsertPositionList(room, 'platforms', tx, ty, item)
    state.selected = { type: 'platform', tx, ty, index, item }
  } else if (state.tool === 'hidden') {
    const item = { tx, ty, tz: Number(els.heightInput.value) || 0 }
    const index = upsertPositionList(room, 'hidden', tx, ty, item)
    state.selected = { type: 'hidden', tx, ty, index, item }
  } else if (state.tool === 'portal') {
    const to = els.portalTarget.value
    const targetRoom = state.catalog[to]
    const item = {
      tx,
      ty,
      to,
      landing: { ...(targetRoom?.spawn ?? { tx: 1, ty: 1 }) },
    }
    const index = upsertPositionList(room, 'portals', tx, ty, item)
    state.selected = { type: 'portal', tx, ty, index, item }
  } else if (state.tool === 'spawn') {
    room.spawn = { tx, ty }
    state.selected = { type: 'spawn', tx, ty, item: room.spawn }
  }
}

function deleteSelected() {
  const room = currentRoom()
  const selected = state.selected
  if (!selected) return

  if (selected.type === 'tile') {
    room.grid[selected.ty][selected.tx] = 1
    removeWallTile(room, selected.tx, selected.ty)
  } else if (selected.type === 'platform' || selected.type === 'hidden' || selected.type === 'portal') {
    room[selected.type].splice(selected.index, 1)
  }
  state.selected = null
}

function formatSelection() {
  const selected = state.selected
  if (!selected) return '<dt>Tool</dt><dd>Click a tile to place</dd>'
  const label = TOOL_LABELS[selected.type] ?? selected.type
  const details = JSON.stringify(selected.item)
  return `
    <dt>Type</dt><dd>${label}</dd>
    <dt>Tile</dt><dd>${selected.tx}, ${selected.ty}</dd>
    <dt>Data</dt><dd>${details}</dd>
  `
}

class RoomEditorScene extends Phaser.Scene {
  constructor() {
    super('RoomEditorScene')
  }

  create() {
    this.originX = 700
    this.originY = 80
    this.drag = { active: false, x: 0, y: 0 }
    this.input.on('pointerdown', pointer => {
      if (pointer.rightButtonDown()) {
        this.drag = { active: true, x: pointer.x, y: pointer.y }
        return
      }
      const hit = this.tileFromPointer(pointer)
      if (hit) {
        const existing = objectAt(currentRoom(), hit.tx, hit.ty)
        if (existing && pointer.event?.shiftKey) state.selected = { ...existing, tx: hit.tx, ty: hit.ty }
        else applyPlacement(hit.tx, hit.ty)
        this.renderRoom()
      }
    })
    this.input.on('pointermove', pointer => {
      if (!this.drag.active) return
      this.originX += pointer.x - this.drag.x
      this.originY += pointer.y - this.drag.y
      this.drag = { active: true, x: pointer.x, y: pointer.y }
      this.renderRoom()
    })
    this.input.on('pointerup', () => {
      this.drag.active = false
    })
    this.renderRoom()
  }

  tileFromPointer(pointer) {
    const room = currentRoom()
    let best = null
    let bestDistance = Infinity
    for (let ty = 0; ty < room.grid.length; ty++) {
      for (let tx = 0; tx < room.grid[ty].length; tx++) {
        const point = toScreen(tx, ty, 0, this.originX, this.originY)
        const dx = pointer.worldX - point.x
        const dy = pointer.worldY - point.y
        const distance = (dx * dx) / (TILE_W * TILE_W) + (dy * dy) / (TILE_H * TILE_H)
        if (distance < bestDistance) {
          best = { tx, ty }
          bestDistance = distance
        }
      }
    }
    return bestDistance < 0.3 ? best : null
  }

  renderRoom() {
    this.children.removeAll(true)
    this.cameras.main.setBackgroundColor(currentRoom().bg ?? '#101018')
    const graphics = this.add.graphics()
    const room = currentRoom()
    for (let ty = 0; ty < room.grid.length; ty++) {
      for (let tx = 0; tx < room.grid[ty].length; tx++) {
        this.drawTile(graphics, tx, ty, room.grid[ty][tx])
      }
    }
    for (const platform of room.platforms ?? []) this.drawMarker(platform, 0xffc857, 'P')
    for (const hidden of room.hidden ?? []) this.drawMarker(hidden, 0x9b5de5, 'H')
    for (const portal of room.portals ?? []) this.drawMarker(portal, 0x00d1ff, 'O')
    if (room.spawn) this.drawMarker(room.spawn, 0xffffff, 'S')
    els.selectionStats.innerHTML = formatSelection()
  }

  drawTile(graphics, tx, ty, tileType) {
    const point = toScreen(tx, ty, 0, this.originX, this.originY)
    const points = [
      { x: point.x, y: point.y - TILE_H / 2 },
      { x: point.x + TILE_W / 2, y: point.y },
      { x: point.x, y: point.y + TILE_H / 2 },
      { x: point.x - TILE_W / 2, y: point.y },
    ]
    graphics.fillStyle(TILE_COLORS[tileType] ?? 0x222222, 0.95)
    graphics.fillPoints(points, true)
    graphics.lineStyle(1, 0x101018, 0.5)
    graphics.strokePoints(points, true)
  }

  drawMarker(item, color, label) {
    const point = toScreen(item.tx, item.ty, item.tz ?? 0, this.originX, this.originY)
    const marker = this.add.circle(point.x, point.y - 8, 12, color, 0.9)
    marker.setStrokeStyle(2, 0x101018)
    const text = this.add.text(point.x, point.y - 8, label, {
      color: '#101018',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: '700',
    })
    text.setOrigin(0.5)
  }
}

function refreshScene() {
  game.scene.getScene('RoomEditorScene')?.renderRoom()
}

function selectTool(tool) {
  state.tool = tool
  for (const button of document.querySelectorAll('[data-tool]')) {
    button.classList.toggle('active', button.dataset.tool === tool)
  }
}

populateRoomOptions()
selectTool(state.tool)

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'editorCanvas',
  width: Math.max(720, window.innerWidth - 380),
  height: window.innerHeight,
  backgroundColor: '#101018',
  scene: RoomEditorScene,
})

els.roomSelect.addEventListener('change', event => {
  state.roomId = event.target.value
  state.selected = null
  populateRoomOptions()
  refreshScene()
})

document.querySelectorAll('[data-tool]').forEach(button => {
  button.addEventListener('click', () => selectTool(button.dataset.tool))
})

els.deleteSelected.addEventListener('click', () => {
  deleteSelected()
  refreshScene()
})

els.exportCatalog.addEventListener('click', () => {
  els.catalogJson.value = formatRoomCatalogSnapshot(exportRoomCatalogSnapshot(state.catalog))
  setStatus('Exported editable room catalog JSON.')
})

els.importCatalog.addEventListener('click', () => {
  try {
    setRooms(importRoomCatalogSnapshot(JSON.parse(els.catalogJson.value)))
    setStatus('Imported catalog JSON.')
    refreshScene()
  } catch (error) {
    setStatus(error.message)
  }
})

window.addEventListener('resize', () => {
  game.scale.resize(Math.max(720, window.innerWidth - 380), window.innerHeight)
  refreshScene()
})
