import { vec3, vec4 } from 'gl-matrix'

import { Atom } from '@tagl/core/atom'
import { Frame } from '@tagl/core/data-structures/frame'
import { Frustum, Object, Shape } from '@tagl/world'

export class AABB {
  bounds = new Atom<{
    x: {
      min: number
      max: number
    }
    y: {
      min: number
      max: number
    }
    z: {
      min: number
      max: number
    }
  }>({
    x: {
      min: Infinity,
      max: -Infinity,
    },
    y: {
      min: Infinity,
      max: -Infinity,
    },
    z: {
      min: Infinity,
      max: -Infinity,
    },
  })
  scratch = vec4.create()
  frame: Frame<Float32Array>
  object: Shape

  constructor(_object: Shape | Object, auto = true) {
    this.object = _object instanceof Object ? _object.shape : _object
    this.frame = new Frame<Float32Array>(null!)
    if (auto) this.object.node.onUpdate(this.computeBounds.bind(this))
    this.computeBounds()
  }

  private computeBounds() {
    this.frame.set(this.object.vertices.get())
    const vertices = this.object.vertices.get()
    for (let i = 0; i < vertices.length / 3; i = i + 3) {
      this.frame.offset = i

      const [x, y, z] = vec3.transformMat4(this.scratch, this.frame.cast(), this.object.node.worldMatrix.get()) as [
        number,
        number,
        number
      ]

      this.bounds.set((bounds) => {
        if (x > bounds.x.max) {
          bounds.x.max = x
        }
        if (x < bounds.x.min) {
          bounds.x.min = x
        }
        if (y > bounds.y.max) {
          bounds.y.max = y
        }
        if (y < bounds.y.min) {
          bounds.y.min = y
        }
        if (z > bounds.z.max) {
          bounds.z.max = z
        }
        if (z < bounds.z.min) {
          bounds.z.min = z
        }
        return bounds
      })
    }
  }

  intersectsFrustum(frustum: Frustum): boolean {
    const bounds = this.bounds.get()
    for (const plane of frustum.planes) {
      const pVertex = vec3.set(
        this.scratch,
        plane[0] > 0 ? bounds.x.max : bounds.x.min,
        plane[1] > 0 ? bounds.y.max : bounds.y.min,
        plane[2] > 0 ? bounds.z.max : bounds.z.min
      )

      // If the positive vertex is outside any plane, the AABB is outside the frustum
      if (vec4.dot(vec4.set(this.scratch, pVertex[0], pVertex[1], pVertex[2], 1), plane) < 0) {
        return false
      }
    }
    // If we're here, the AABB is at least partially in the frustum
    return true
  }
}
