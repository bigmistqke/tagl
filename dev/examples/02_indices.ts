import { attribute, createGL, glsl, uniform } from 'src'

import { mat4 } from 'gl-matrix'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)
const gl = createGL(canvas)
gl.autosize()

const camera = uniform.mat4(
  (() => {
    const matrix = mat4.create()
    mat4.translate(matrix, matrix, [0, 0, 0])
    return matrix as Float32Array
  })()
)

const perspective = uniform.mat4(
  mat4.perspective(mat4.create(), Math.PI / 2, canvas.clientWidth / canvas.clientHeight, 0, Infinity) as Float32Array
)

type BaseMesh = {
  color: Float32Array
  vertices: Float32Array
  position: Float32Array
  uv: Float32Array
}
type MeshWithCount = BaseMesh & {
  count: number
  indices?: never
}
type MeshWithIndices = BaseMesh & {
  indices: number[]
  count?: never
}
type Mesh = MeshWithCount | MeshWithIndices

const createShape = ({ color, count, indices, position, uv, vertices }: Mesh) => {
  const u_color = uniform.vec3(color)
  const a_vertices = attribute.vec3(vertices)
  const u_position = uniform.vec3(position)
  const u_uv = attribute.vec2(uv)

  const vertex = glsl`#version 300 es
    precision highp float;
    out vec2 uv;  
    void main(void) {
      uv = ${u_uv};
      gl_Position = ${camera} * ${perspective} * vec4(${a_vertices} * 0.1 + ${u_position}, 1);
      gl_PointSize = 5.;
    }`

  const fragment = glsl`#version 300 es
    precision highp float;
    out vec4 color;
    in vec2 uv;
    void main(void) {
      float radius = distance(uv, vec2(0.5, 0.5));
      if(radius > 0.5){
        discard;
      }else{
        color = vec4(${u_color}, 1.);
      }
    }`

  return {
    ...gl.createProgram(/* count ? { vertex, fragment, count } :  */ { vertex, fragment, indices: indices! }),
    setColor: u_color.set,
    setPosition: u_position.set,
    position,
  }
}

//prettier-ignore
const plane = createShape({
  color: new Float32Array([Math.random(), Math.random(), Math.random()]),
  position: new Float32Array([0, 0, -2]),
  vertices: new Float32Array([
    -0.5, -0.5, 0.0, 
    0.5, -0.5, 0.0, 
    -0.5, 0.5, 0.0, 
    0.5, 0.5, 0.0, 
  ]),
  uv: new Float32Array([
    0, 0, 
    1, 0, 
    0, 1, 
    1, 1, 
  ]),
  indices: [0, 1, 2, 3, 2, 1],
})

gl.ctx.depthFunc(gl.ctx.LEQUAL)
gl.ctx.depthRange(0.2, 10)
gl.ctx.clearDepth(1.0)

gl.setStack(plane)
gl.requestRender()
