/**
 * 离线校验 client.js 的逻辑：
 * 用一个极简假 DOM 模拟「列表 → 详情 → 返回列表」，断言返回后 scrollTop 被还原。
 */
const assert = require('node:assert')
const path = require('node:path')

// ---- 极简假 DOM ----
const VIEWPORT = 700

class FakeBody {
  constructor() {
    this.scrollTop = 0
    this.height = 2000
    this.detail = false
    this._scroll = []
  }
  querySelector() { return this.detail ? {} : null }
  addEventListener(_, fn) { this._scroll.push(fn) }
  get maxScroll() { return Math.max(0, this.height - VIEWPORT) }
  /** 模拟浏览器：内容变矮时把 scrollTop 夹住，并补一个 scroll 事件 */
  setContent(nextHeight) {
    this.height = nextHeight
    const before = this.scrollTop
    this.scrollTop = Math.min(this.scrollTop, this.maxScroll)
    if (this.scrollTop !== before) for (const fn of this._scroll) fn()
  }
  scrollTo(v) {
    this.scrollTop = Math.min(Math.max(0, v), this.maxScroll)
    for (const fn of this._scroll) fn()
  }
}

const body = new FakeBody()
let rafQueue = []
const observers = []

global.window = {
  __ModuleLoader__: {
    load(mod) {
      const api = mod.factory(() => {})
      const cleanups = []
      api.apply({ effect: (fn) => cleanups.push(fn()) })
      global.__cleanups = cleanups
    },
  },
}
global.document = {
  body: {},
  querySelectorAll: (sel) => (sel === '[data-plugin-body]' ? [body] : []),
}
global.MutationObserver = class {
  constructor(fn) { observers.push(fn) }
  observe() {}
  disconnect() {}
}
global.requestAnimationFrame = (fn) => rafQueue.push(fn)
global.cancelAnimationFrame = () => {}

/** 跑完所有排队帧；帧里可能再排队（回填补帧），所以循环到空 */
function flush() {
  for (let i = 0; i < 20 && rafQueue.length; i += 1) {
    const queue = rafQueue
    rafQueue = []
    for (const fn of queue) fn()
  }
}

/** 模拟一次 DOM 变动：内核每次切换视图都会动 DOM */
function mutate() {
  for (const fn of observers) fn()
  flush()
}

// ---- 场景 ----
require(path.join(__dirname, 'client.js'))
flush() // 首次扫描

// 1. 列表里滚到 900
body.scrollTo(900)
assert.strictEqual(body.scrollTop, 900, '列表滚动应生效')

// 2. 打开详情：列表被替换，内容变矮，scrollTop 被夹到 0
body.detail = true
body.setContent(500)
mutate()
assert.strictEqual(body.scrollTop, 0, '详情态 scrollTop 归零')

// 3. 在详情里继续滚，不应污染列表位置
body.setContent(1600)
body.scrollTo(400)
mutate()

// 4. 返回列表：详情消失，高度恢复
body.detail = false
body.setContent(2000)
mutate()

assert.strictEqual(body.scrollTop, 900, '返回列表后应回到 900，实际 ' + body.scrollTop)
console.log('✓ 列表 900 → 详情（滚到 400）→ 返回列表 900')

// 5. 第二次往返同样成立（1500 超过该高度的最大值 1300，会被夹到 1300）
body.scrollTo(1500)
assert.strictEqual(body.scrollTop, 1300, '1500 被夹到 1300')
body.detail = true
body.setContent(500)
mutate()
body.setContent(1600)
body.scrollTo(120)
mutate()
body.detail = false
body.setContent(2000)
mutate()
assert.strictEqual(body.scrollTop, 1300, '第二次往返应回到 1300，实际 ' + body.scrollTop)
console.log('✓ 第二次往返 1300 → 详情 → 返回列表 1300')

// 6. 列表本身滚到 0 也应该被记住（不是被当成"没记录"）
body.scrollTo(0)
body.detail = true
body.setContent(500)
mutate()
body.detail = false
body.setContent(2000)
mutate()
assert.strictEqual(body.scrollTop, 0, '顶部返回顶部')
console.log('✓ 列表在顶部时返回仍在顶部')

// 7. 卸载后不再监听
for (const fn of global.__cleanups) if (typeof fn === 'function') fn()
console.log('✓ 卸载清理无异常')
