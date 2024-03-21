import { Atom, atomize, effect } from '@tagl/core/atom'

import { Shape, ShapeOptions } from '../primitives/shape'

export class Sphere extends Shape {
  radius: Atom<number>
  segments: Atom<number>
  rings: Atom<number>

  constructor(
    options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv'> & {
      radius: number | Atom<number>
      segments: number | Atom<number>
      rings: number | Atom<number>
    }
  ) {
    const vertices = new Atom(new Float32Array())
    const uv = new Atom(new Float32Array())
    const indices = new Atom(new Uint16Array())

    super({
      vertices,
      uv,
      indices,
      matrix: options.matrix,
      color: options.color,
      mode: options.mode,
    })

    this.radius = atomize(options.radius)
    this.segments = atomize(options.segments)
    this.rings = atomize(options.rings)

    effect([this.radius, this.segments], this.update.bind(this))
  }

  update() {
    const segments = this.segments.get()
    const rings = this.rings.get() - 2
    const radius = this.radius.get()

    const vertices: number[] = []

    // Add the top pole
    vertices.push(0, radius, 0)

    // Generate vertices (excluding the poles)
    for (let y = 1; y < rings; y++) {
      let segmentRatio = y / rings
      let theta = segmentRatio * Math.PI // from 0 to Pi
      let sinTheta = Math.sin(theta)
      let cosTheta = Math.cos(theta)

      for (let x = 0; x <= segments; x++) {
        let sectorRatio = x / segments
        let phi = sectorRatio * 2 * Math.PI // from 0 to 2Pi
        let sinPhi = Math.sin(phi)
        let cosPhi = Math.cos(phi)

        let vx = radius * sinTheta * cosPhi
        let vy = radius * cosTheta
        let vz = radius * sinTheta * sinPhi

        vertices.push(vx, vy, vz)
      }
    }

    // Add the bottom pole
    vertices.push(0, -radius, 0)

    // Generate indices for triangles
    // Top cap
    const indices = []
    for (let x = 0; x < segments; x++) {
      indices.push(0, x + 1, x + 2)
    }

    // Middle area
    let offset = 1 // Offset for the vertices because of the top pole
    for (let y = 0; y < rings - 2; y++) {
      for (let x = 0; x < segments; x++) {
        let a = y * (segments + 1) + x + offset
        let b = a + segments + 1
        let c = a + 1
        let d = b + 1

        indices.push(a, b, c)
        indices.push(b, d, c)
      }
    }

    // Bottom cap
    let bottomPoleIndex = vertices.length / 3 - 1
    let baseIndexForBottomCap = bottomPoleIndex - segments - 1
    for (let x = 0; x < segments; x++) {
      indices.push(bottomPoleIndex, baseIndexForBottomCap + x, baseIndexForBottomCap + x + 1)
    }

    this.vertices.set(new Float32Array(vertices))
    this.indices!.set(new Uint16Array(indices))
  }
}
