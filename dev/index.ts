import {
  createAttribute,
  createProgram,
  createStack,
  createUniform,
  glsl,
} from 'src'

import { mat4 } from 'gl-matrix'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)
const gl = canvas.getContext('webgl2')!

const [camera, setCamera] = createUniform(
  'mat4',
  (() => {
    const matrix = mat4.create()
    mat4.translate(matrix, matrix, [0, 0, 0])

    return matrix as Float32Array
  })()
)

const [perspective, setPerspective] = createUniform(
  'mat4',
  mat4.perspective(
    mat4.create(),
    Math.PI / 2,
    canvas.clientWidth / canvas.clientHeight,
    0,
    Infinity
  ) as Float32Array
)

const createPlane = ({
  color,
  vertices,
  position,
}: {
  color: Float32Array
  vertices: Float32Array
  position: Float32Array
}) => {
  const [u_color, setColor] = createUniform('vec3', color)
  const [a_vertices, setVertices] = createAttribute('vec3', vertices)
  const [u_position, setPosition] = createUniform('vec3', position)

  const vertex = glsl`#version 300 es
    precision highp float;
    void main(void) {
      gl_Position = ${perspective} * vec4(${a_vertices} + ${u_position}, 1);
      gl_PointSize = 5.;
    }`

  const vertex2 = glsl`#version 300 es
    precision highp float;
    out vec4 model;
    out vec4 view;
    out vec4 clip;
    out vec2 uv;
    out vec3 color;
    void main(void) {
      color = ${u_color};
      model = vec4(${u_position} + ${a_vertices}, 1.);
      clip = ${perspective} * model;
      gl_Position = clip;
      gl_PointSize = 5.;
    }`

  const fragment = glsl`#version 300 es
    precision highp float;
    out vec4 color;
    void main(void) {
      color = vec4(${u_color}, 1.);
    }`

  return {
    program: createProgram({ gl, vertex, fragment, count: 3 }),
    setColor,
    setVertices,
    setPosition,
  }
}

const vertices = new Float32Array([
  -0.5, -0.5, 0.0, 0.5, -0.5, 0.0, -0.5, 0.5, 0.0,
])

const program1 = createPlane({
  color: new Float32Array([0, 1, 0]),
  vertices,
  position: new Float32Array([0, 0, -1]),
})
const program2 = createPlane({
  color: new Float32Array([1, 0, 0]),
  vertices: new Float32Array([-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, -1, 0.5, 0.0]),
  position: new Float32Array([0, 0, -1]),
})
const program3 = createPlane({
  color: new Float32Array([1, 0, 0]),
  vertices,
  position: new Float32Array([0, 0, 0]),
})

const stack = createStack(program1.program, program2.program)
stack.draw()
const loop = (now: number) => {
  program1.setPosition((value) => {
    value[0] = Math.sin(now / 1000)
    value[1] = Math.cos(now / 1000)
    return value
  })
  program2.setColor((value) => {
    value[1] = Math.sin(now / 1000) / 2 + 0.5
    return value
  })
  requestAnimationFrame(loop)
}
loop(performance.now())
