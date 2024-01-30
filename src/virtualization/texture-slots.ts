import { DequeMap } from '../data-structures/deque-map'
import { createInstantiator } from '../utils'

export class TextureSlots {
  // deque managing texture-slots
  textureSlots: DequeMap<WebGLTexture, number> = new DequeMap()
  // texture-callbacks of current WebGLProgram's render-call.
  pendingTextureCallbacks = new Map<WebGLTexture, ((index: number) => void)[]>()
  // hardware-dependent constant
  MAX_COMBINED_TEXTURE_IMAGE_UNITS = -1

  enqueueTextureBinding(
    texture: WebGLTexture,
    callback: (index: number) => void
  ) {
    // if textureslot is already
    const slot = this.textureSlots.get(texture)
    if (slot) {
      // set slot to end of list
      this.textureSlots.touch(texture, null!)
      callback(slot)
      return
    }

    const callbacks = this.pendingTextureCallbacks.get(texture)

    if (callbacks) {
      callbacks.push(callback)
      return
    }

    this.pendingTextureCallbacks.set(texture, [callback])
  }

  resolveTextureBindingQueue() {
    for (const [texture, callbacks] of this.pendingTextureCallbacks) {
      const slot = this.textureSlots.touch(texture, () =>
        this.textureSlots.map.size >= this.MAX_COMBINED_TEXTURE_IMAGE_UNITS
          ? this.textureSlots.shift()!
          : this.textureSlots.map.size + 1
      )
      callbacks.forEach((callback) => callback(slot))
    }
    this.pendingTextureCallbacks.clear()
  }

  static create(gl: WebGL2RenderingContext) {
    const instance = createInstantiator<WebGL2RenderingContext>()(this)(gl)
    instance.MAX_COMBINED_TEXTURE_IMAGE_UNITS = gl.getParameter(
      gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS
    )
    return instance
  }
}
