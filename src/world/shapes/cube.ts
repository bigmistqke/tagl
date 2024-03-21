import { Shape, ShapeOptions } from '../primitives/shape'

// prettier-ignore
const _cube = {
  vertices: new Float32Array([
    // Front face
    -0.5, -0.5,  0.5,    0.5, -0.5,  0.5,    0.5,  0.5,  0.5,   -0.5,  0.5,  0.5,
    // Back face
    -0.5, -0.5, -0.5,   -0.5,  0.5, -0.5,    0.5,  0.5, -0.5,    0.5, -0.5, -0.5,
    // Top face
    -0.5,  0.5, -0.5,   -0.5,  0.5,  0.5,    0.5,  0.5,  0.5,    0.5,  0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5,    0.5, -0.5, -0.5,    0.5, -0.5,  0.5,   -0.5, -0.5,  0.5,
    // Right face
    0.5, -0.5, -0.5,    0.5,  0.5,  -0.5,    0.5,  0.5,  0.5,    0.5, -0.5,  0.5,
    // Left face
    -0.5, -0.5, -0.5,   -0.5, -0.5,  0.5,   -0.5,  0.5,  0.5,   -0.5,  0.5, -0.5,
  ]),
  uv: new Float32Array([
    // Front face
    0.0, 1.0,  // Vertex 0
    1.0, 1.0,  // Vertex 1
    1.0, 0.0,  // Vertex 2
    0.0, 0.0,  // Vertex 3
    // Back face
    0.0, 1.0,  // Vertex 4
    1.0, 1.0,  // Vertex 5
    1.0, 0.0,  // Vertex 6
    0.0, 0.0,  // Vertex 7
    // Top face
    0.0, 1.0,  // Vertex 8
    1.0, 1.0,  // Vertex 9
    1.0, 0.0,  // Vertex 10
    0.0, 0.0,  // Vertex 11
    // Bottom face
    0.0, 1.0,  // Vertex 12
    1.0, 1.0,  // Vertex 13
    1.0, 0.0,  // Vertex 14
    0.0, 0.0,  // Vertex 15
    // Right face
    0.0, 1.0,  // Vertex 16
    1.0, 1.0,  // Vertex 17
    1.0, 0.0,  // Vertex 18
    0.0, 0.0,  // Vertex 19
    // Left face
    0.0, 1.0,  // Vertex 20
    1.0, 1.0,  // Vertex 21
    1.0, 0.0,  // Vertex 22
    0.0, 0.0   // Vertex 23
  ]),
  indices:  new Uint16Array([
    // Front face
    0,   1,  2,  0,  2,  3,
    // Back face
    4,   5,  6,  4,  6,  7,
    // Top face
    8,   9, 10,  8, 10, 11,
    // Bottom face
    12, 13, 14, 12, 14, 15,
    // Right face
    16, 17, 18, 16, 18, 19,
    // Left face
    20, 21, 22, 20, 22, 23,
  ]),
}

export class Cube extends Shape {
  constructor(options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv' | 'count'>) {
    super({
      ...options,
      ..._cube,
    })
  }
}
