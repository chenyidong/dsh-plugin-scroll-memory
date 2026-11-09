/**
 * 插件管理页滚动位置记忆。
 *
 * 内核的插件页把列表和详情渲染在同一个滚动容器 [data-plugin-body] 里，
 * 详情替换列表时没有保存 scrollTop，返回列表自然回到顶部。
 *
 * 这里只做两件事：
 *   - 列表可见时持续记录容器的 scrollTop；
 *   - 详情节点消失（= 刚回到列表）时，下一帧把记录值写回去。
 *
 * 详情态由内核自带的三个标记识别，三种详情页都覆盖：
 *   [data-plugin-detail]      组合包详情
 *   [data-plugin-item-detail] 官方插件条目详情
 *   [data-market-detail]      「发现」市场条目详情
 *
 * 判断一律读实时 DOM 而不是缓存状态：换到详情时浏览器会把 scrollTop 夹到 0
 * 并补一个 scroll 事件，那个事件里详情节点已经存在，所以不会被误记成 0。
 *
 * 不注册 slot、不读 host 服务、不改内核文件，卸载即净。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-scroll-memory',
  factory() {
    const BODY = '[data-plugin-body]'
    const DETAIL = '[data-plugin-detail],[data-plugin-item-detail],[data-market-detail]'

    /** 每个滚动容器一份记录；容器被重新挂载就自然归零。 */
    const tracked = new WeakMap()

    function hasDetail(body) {
      return body.querySelector(DETAIL) !== null
    }

    function track(body) {
      let entry = tracked.get(body)
      if (entry === undefined) {
        entry = { listOffset: 0, inDetail: hasDetail(body), frame: 0 }
        tracked.set(body, entry)
        body.addEventListener(
          'scroll',
          () => {
            // 详情里滚的是详情自己，不能覆盖列表位置；夹到 0 的伪事件同理。
            if (!hasDetail(body)) entry.listOffset = body.scrollTop
          },
          { passive: true },
        )
      }
      return entry
    }

    /**
     * 详情消失后的回填。等一帧让列表先渲染出高度；高度还不够（列表项刚挂载、
     * 图标未撑开）时会被浏览器夹住，这时再补一帧。
     */
    function restore(body, entry) {
      const apply = () => {
        body.scrollTop = entry.listOffset
      }
      entry.frame = requestAnimationFrame(() => {
        apply()
        if (Math.abs(body.scrollTop - entry.listOffset) > 1) {
          entry.frame = requestAnimationFrame(apply)
        }
      })
    }

    function sync(body) {
      const entry = track(body)
      const detail = hasDetail(body)
      if (entry.inDetail && !detail) restore(body, entry)
      entry.inDetail = detail
    }

    let queued = 0

    /** 整页 DOM 变动很频繁（流式回复也在动），合并成每帧最多扫一次。 */
    function schedule() {
      if (queued !== 0) return
      queued = requestAnimationFrame(() => {
        queued = 0
        for (const body of document.querySelectorAll(BODY)) sync(body)
      })
    }

    return {
      name: 'dsh-plugin-scroll-memory',
      inject: [],
      apply(ctx) {
        const observer = new MutationObserver(schedule)
        // immediately: true 的包可能在 body 之前加载，等 DOM 就绪再挂。
        const start = () => {
          observer.observe(document.body, { childList: true, subtree: true })
          schedule()
        }
        if (document.body === null) document.addEventListener('DOMContentLoaded', start, { once: true })
        else start()
        ctx.effect(() => () => {
          observer.disconnect()
          cancelAnimationFrame(queued)
        })
      },
    }
  },
})
