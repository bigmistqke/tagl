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

gl.enable(gl.DEPTH_TEST)
gl.depthFunc(gl.LEQUAL)
gl.depthRange(0.2, 10)

const [camera, setCamera] = createUniform(
  'mat4',
  (() => {
    const matrix = mat4.create()
    mat4.translate(matrix, matrix, [-1.5, -1.5, 0])

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
  offset,
}: {
  color: Float32Array
  vertices: Float32Array
  position: Float32Array
  offset: Float32Array
}) => {
  const [u_color, setColor] = createUniform('vec3', color)
  const [a_vertices, setVertices] = createAttribute('vec3', vertices)
  const [u_position, setPosition] = createUniform('vec3', position)

  const vertex = glsl`#version 300 es
    precision highp float;
    void main(void) {
      gl_Position = ${camera} * ${perspective} * vec4(${a_vertices} * 0.1 + ${u_position}, 1);
      gl_PointSize = 5.;
    }`

  const fragment = glsl`#version 300 es
    precision highp float;
    out vec4 color;
    void main(void) {
      color = vec4(${u_color}, 1.);
    }`

  return {
    ...createProgram({ gl, vertex, fragment, count: 3 }),
    setColor,
    setVertices,
    setPosition,
    offset,
  }
}

const vertices = new Float32Array([
  -0.5, -0.5, 0.0, 0.5, -0.5, 0.0, -0.5, 0.5, 0.0,
])

const planes = Array.from({ length: 7500 }).map(() => ({
  ...createPlane({
    color: new Float32Array([Math.random(), Math.random(), Math.random()]),
    vertices,
    offset: new Float32Array([Math.random() * 6, Math.random() * 6]),
    position: new Float32Array([0, 0, -2 + Math.random()]),
  }),
  timeOffset: Math.random(),
}))

createStack(...planes)

gl.depthFunc(gl.LEQUAL)
gl.depthRange(0.2, 10)
gl.clearDepth(1.0)

const loop = (now: number) => {
  for (let i = 0; i < planes.length; i++) {
    const plane = planes[i]!
    plane.setPosition((value) => {
      value[0] = plane.offset[0]! + Math.sin(plane.timeOffset + now / 1000)
      value[1] = plane.offset[1]! + Math.cos(plane.timeOffset + now / 1000)
      return value
    })
    plane.setColor((value) => {
      value[1] = Math.sin(plane.timeOffset + now / 1000) / 2 + 0.5
      return value
    })
  }

  requestAnimationFrame(loop)
}
loop(performance.now())
