import { mat4, vec3 } from 'gl-matrix'
import { atom } from 'src/core/tokens'
import { createDisc, createScene } from 'world'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = createScene(canvas)
scene.autosize()

const color = atom(vec3.fromValues(1, 0, 0))

const disc = createDisc({
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
disc.bind(scene)

const colors = [
  [1, 0, 0],
  [0, 1, 0],
] as const
let count = 0

const waitFor = (delta = 1000) => new Promise((resolve) => setTimeout(resolve, delta))

const animation = async () => {
  const disc2 = createDisc({
    color,
    matrix: mat4.create(),
    radius: 5,
    segments: 4,
  })
  const disc3 = createDisc({
    color: [1, 1, 0],
    matrix: (() => {
      const matrix = mat4.create()
      mat4.translate(matrix, matrix, [1, 0, 0])
      return matrix
    })(),
    radius: 5,
    segments: 4,
  })

  disc3.bind(disc2)

  setInterval(() => {
    disc2.matrix.set((matrix) => mat4.rotate(matrix, matrix, 0.1, [0, 0, 1]))
    disc3.matrix.set((matrix) => mat4.rotate(matrix, matrix, 0.1, [0, 0.5, 1]))
  }, 100)

  // await waitFor()
  disc2.bind(scene)

  /* await waitFor()
  disc3.unbind() */
}

animation()

/* setInterval(() => {
  count++
  color.set((color) => vec3.set(color, ...colors[count % 2]))
}, 2000) */
