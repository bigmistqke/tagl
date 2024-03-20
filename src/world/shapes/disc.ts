import { vec3 } from 'gl-matrix'

import { atom, effect } from '@tagl/core'
import { Atom } from '@tagl/core/atom'

import { Object } from './object'
import { Shape, ShapeOptions } from './shape'

const cache = {
  vertices: [] as Float32Array[],
  indices: [] as Uint16Array[],
}

export class Disc<TData extends Record<string, any>> extends Object<TData> {
  radius: Atom<number>
  segments: Atom<number>

  constructor(
    options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv'> & {
      radius: number
      segments: number
    }
  ) {
    const shape = new Shape<TData>({
      vertices: atom(new Float32Array()),
      uv: atom(new Float32Array()),
      indices: atom(new Uint16Array()),
      matrix: options.matrix,
      color: options.color,
      mode: options.mode,
    })

    super(shape)

    this.radius = atom(options.radius)
    this.segments = atom(options.segments)
    effect(this.update.bind(this), [this.radius, this.segments])
  }

  update() {
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
