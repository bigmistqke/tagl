import { vec3 } from 'gl-matrix'

import { effect } from '@tagl/core'
import { Atom } from '@tagl/core/atom'

import { Shape, ShapeOptions } from '../primitives/shape'

const cache = {
  vertices: [] as Float32Array[],
  indices: [] as Uint16Array[],
}

export class Disc extends Shape {
  radius: Atom<number>
  segments: Atom<number>

  constructor(
    options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv'> & {
      radius: number
      segments: number
    }
  ) {
    super({
      vertices: new Atom(new Float32Array()),
      uv: new Atom(new Float32Array()),
      indices: new Atom(new Uint16Array()),
      matrix: options.matrix,
      color: options.color,
      mode: options.mode,
    })
    this.radius = new Atom(options.radius)
    this.segments = new Atom(options.segments)
    effect(this.updateWorldMatrix.bind(this), [this.radius, this.segments])
  }

  updateWorldMatrix() {
    const size = this.segments.get() + 1

    this.vertices.set(() => {
      const cached = cache.vertices[this.segments.get()]
      if (cached) return cached

      const vertices = new Float32Array(size * 3)

      for (let index = 0; index <= vertices.length; index = index + 3) {
        const vertex = vertices.subarray(index, index + 2)
        if (index === 0) {
          vec3.set(vertex, 0, 0, 0)
          continue
        }
        const ratio = (index / 3 - 1) / this.segments.get()
        vec3.set(
          vertex,
          Math.sin(ratio * Math.PI * 2) * this.radius.get(),
          Math.cos(ratio * Math.PI * 2) * this.radius.get(),
          0
        )
      }

      this.uv.set(vertices)

      return (cache.vertices[this.segments.get()] = vertices)
    })

    this.indices!.set(() => {
      const cached = cache.indices[this.segments.get()]
      if (cached) return cached

      const indices: number[] = []
      for (let i = 1; i < size; i++) {
        if (i + 1 === size) {
          indices.push(i, 1, 0)
        } else {
          indices.push(i, i + 1, 0)
        }
      }

      return (cache.indices[this.segments.get()] = new Uint16Array(indices))
    })
  }
}
