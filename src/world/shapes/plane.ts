import { Shape, ShapeOptions } from '../primitives/shape'

const _plane = {
  vertices: new Float32Array([-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, -0.5, 0.5, 0.0, 0.5, 0.5, 0.0]),
  uv: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
  indices: new Uint16Array([0, 1, 2, 3, 2, 1]),
}
export class Plane extends Shape {
  constructor(options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv' | 'count'>) {
    super({
      ...options,
      ..._plane,
    })
  }
}
