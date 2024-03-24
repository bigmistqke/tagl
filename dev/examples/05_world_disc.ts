import { mat4, vec3 } from 'gl-matrix'
import { atom } from 'src/core/tokens'
import { createDisc, createScene } from 'world'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = createScene(canvas)
scene.autosize()

const color = atom(vec3.fromValues(1, 0, 0))

const disc2 = createDisc({
  color,
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
  const disc3 = createDisc({
    color,
    matrix: mat4.create(),
    radius: 5,
    segments: 4,
  })
  scene.add(disc3)

  setTimeout(() => {
    const matrix = mat4.create()
    mat4.translate(matrix, matrix, [0, 0, -1])
    const disc4 = createDisc({
      color,
      matrix: mat4.create(),
      radius: 2,
      segments: 5,
    })
    scene.add(disc4)

    setTimeout(() => {
      const matrix = mat4.create()
      mat4.translate(matrix, matrix, [-2, -1, 0])
      const disc4 = createDisc({
        color,
        matrix,
        radius: 2,
        segments: 5,
      })
      scene.add(disc4)
    }, 1000)
  }, 1000)
}, 1000)

setInterval(() => {
  count++
  color.set((color) => vec3.set(color, ...colors[count % 2]))
}, 2000)
