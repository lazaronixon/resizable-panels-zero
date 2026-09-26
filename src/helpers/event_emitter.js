// A minimal synchronous emitter. Listeners are copied before a dispatch so one
// that subscribes or unsubscribes while it runs cannot skip its neighbours, and
// the first error is rethrown only after every listener has had its turn.
export default class EventEmitter {
  #listenerMap = {}

  addListener(type, listener) {
    const listeners = this.#listenerMap[type]
    if (listeners === undefined) {
      this.#listenerMap[type] = [ listener ]
    } else if (!listeners.includes(listener)) {
      listeners.push(listener)
    }

    return () => this.removeListener(type, listener)
  }

  emit(type, data) {
    const listeners = this.#listenerMap[type]
    if (listeners === undefined) return

    if (listeners.length === 1) {
      listeners[0].call(null, data)
      return
    }

    let didThrow = false
    let caughtError = null

    for (const listener of Array.from(listeners)) {
      try {
        listener.call(null, data)
      } catch (error) {
        if (!didThrow) {
          didThrow = true
          caughtError = error
        }
      }
    }

    if (didThrow) throw caughtError
  }

  removeAllListeners() {
    this.#listenerMap = {}
  }

  removeListener(type, listener) {
    const listeners = this.#listenerMap[type]
    if (listeners === undefined) return

    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }
}
