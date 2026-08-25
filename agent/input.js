// Native Win32 input via koffi FFI - zero PowerShell overhead
let user32
try {
 const koffi = require('koffi')
 user32 = koffi.load('user32.dll')
} catch (e) {
 console.log('[input] koffi not available, falling back to PowerShell')
}

let SetCursorPos, mouse_event, keybd_event

if (user32) {
 SetCursorPos = user32.func('SetCursorPos', 'bool', ['int32', 'int32'])
 mouse_event = user32.func('mouse_event', 'void', ['uint32', 'int32', 'int32', 'uint32', 'uint64'])
 keybd_event = user32.func('keybd_event', 'void', ['uint8', 'uint8', 'uint32', 'uint64'])
 console.log('[input] Native Win32 input loaded (koffi)')
}

const MF = {
 LEFTDOWN: 0x0002, LEFTUP: 0x0004,
 RIGHTDOWN: 0x0008, RIGHTUP: 0x0010,
 MIDDLEDOWN: 0x0020, MIDDLEUP: 0x0040,
 WHEEL: 0x0800,
 KEYUP: 0x0002
}

const VK = {
 'control': 0x11, 'ctrl': 0x11, 'alt': 0x12, 'menu': 0x12,
 'shift': 0x10, 'lwin': 0x5B, 'win': 0x5B, 'meta': 0x5B,
 'enter': 0x0D, 'tab': 0x09, 'escape': 0x1B, 'esc': 0x1B,
 'backspace': 0x08, 'delete': 0x2E, 'space': 0x20,
 'arrowup': 0x26, 'arrowdown': 0x28, 'arrowleft': 0x25, 'arrowright': 0x27,
 'home': 0x24, 'end': 0x23, 'pageup': 0x21, 'pagedown': 0x22,
 'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74,
 'f6': 0x75, 'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79,
 'f11': 0x7A, 'f12': 0x7B,
 'capslock': 0x14, 'numlock': 0x90, 'printscreen': 0x2C,
}

function getVk(key) {
 const k = key.toLowerCase()
 if (VK[k] !== undefined) return VK[k]
 if (k.length === 1) return k.toUpperCase().charCodeAt(0)
 return 0
}

function getMouseButton(btn) {
 if (btn === 'right') return { down: MF.RIGHTDOWN, up: MF.RIGHTUP }
 if (btn === 'middle') return { down: MF.MIDDLEDOWN, up: MF.MIDDLEUP }
 return { down: MF.LEFTDOWN, up: MF.LEFTUP }
}

function simulateMouse(event) {
 const { x, y, button, type, scroll } = event
 if (!user32) return

 if (type === 'scroll') {
 SetCursorPos(x, y)
 const delta = (scroll || 1) > 0 ? 120 : -120
 mouse_event(MF.WHEEL, 0, 0, delta, 0)
 } else if (type === 'click') {
 const mb = getMouseButton(button)
 SetCursorPos(x, y)
 mouse_event(mb.down, 0, 0, 0, 0)
 setTimeout(() => mouse_event(mb.up, 0, 0, 0, 0), 30)
 } else if (type === 'dblclick') {
 const mb = getMouseButton(button)
 SetCursorPos(x, y)
 mouse_event(mb.down, 0, 0, 0, 0)
 setTimeout(() => mouse_event(mb.up, 0, 0, 0, 0), 25)
 setTimeout(() => mouse_event(mb.down, 0, 0, 0, 0), 60)
 setTimeout(() => mouse_event(mb.up, 0, 0, 0, 0), 85)
 } else if (type === 'move') {
 SetCursorPos(x, y)
 } else if (type === 'mousedown') {
 const mb = getMouseButton(button)
 SetCursorPos(x, y)
 mouse_event(mb.down, 0, 0, 0, 0)
 } else if (type === 'mouseup') {
 const mb = getMouseButton(button)
 SetCursorPos(x, y)
 mouse_event(mb.up, 0, 0, 0, 0)
 }
}

function simulateKeyboard(event) {
 const { key, combo, type } = event
 if (!user32) return

 if (combo) {
 const parts = combo.split('+').map(s => s.trim().toLowerCase())
 const modifiers = []
 const mainKeys = []

 for (const p of parts) {
 const vk = getVk(p)
 if ([0x11, 0x12, 0x10, 0x5B].includes(vk)) {
 modifiers.push(vk)
 } else {
 mainKeys.push({ name: p, vk })
 }
 }

 // Press modifiers
 for (const vk of modifiers) keybd_event(vk, 0, 0, 0)
 // Press main key(s)
 for (const k of mainKeys) keybd_event(k.vk, 0, 0, 0)
 // Release main key(s)
 setTimeout(() => {
 for (const k of mainKeys) keybd_event(k.vk, 0, MF.KEYUP, 0)
 // Release modifiers
 for (const vk of [...modifiers].reverse()) keybd_event(vk, 0, MF.KEYUP, 0)
 }, 40)
 return
 }

 const vk = getVk(key)
 if (!vk) return

 if (type === 'keydown') {
 keybd_event(vk, 0, 0, 0)
 } else if (type === 'keyup') {
 keybd_event(vk, 0, MF.KEYUP, 0)
 }
}

module.exports = { simulateMouse, simulateKeyboard }
