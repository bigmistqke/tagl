import { mat4 } from 'gl-matrix'
import { createDisc, createScene } from 'world'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = createScene(canvas)
scene.autosize()

const disc2 = createDisc({
  color: new Float32Array([1, 0, 0]),
  matrix: (() => {
    const matrix = mat4.create()
    mat4.translate(matrix, matrix, [0, 1, 0])
    return matrix
  })(),
  radius: 5,
  segments: 3,
})

scene.camera.set((camera) => mat4.translate(camera, camera, [0, 0, -1]))
scene.add(disc2)

const colors = [
  [1, 0, 0],
  [0, 1, 0],
] as const
let count = 0

setTimeout(() => {
  const disc = createDisc({
    color: new Float32Array([1, 0, 0]),
    matrix: mat4.create(),
    radius: 5,
    segments: 5,
  })
  disc2.add(disc)
}, 1000)

setTimeout(() => {
  count++
}, 0)

/* scene.onLoop((time) => {
  disc.matrix.set((matrix) => {
    mat4.rotateX(matrix, matrix, 0.01 * Math.sin(time / 1000))
    mat4.rotateY(matrix, matrix, 0.01)
    return matrix
  })
  disc.radius.set((Math.sin(time / 1000) + 1) * 2 + 2)
}) */
