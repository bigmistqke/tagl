import { mat4 } from 'gl-matrix'
import { Shape, createDisc, createScene } from 'world'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = createScene(canvas)
scene.autosize()
scene.camera.set((camera) => mat4.translate(camera, camera, [0, 0, -5]))

let previousDisc: Shape

const arm = Array.from({ length: 1000 }).map((_, index) => {
  const matrix = mat4.create()
  mat4.translate(matrix, matrix, [1, 0, 0])
  mat4.scale(matrix, matrix, [1, 1, 1])

  const disc = createDisc({
    color: [0, 1, 0],
    matrix,
    radius: 5,
    segments: 4,
  })

  if (previousDisc) {
    disc.bind(previousDisc)
  } else {
    disc.bind(scene)
  }
  previousDisc = disc
  return disc
})

scene.onLoop(() => {
  arm.forEach(({ matrix }, index) => matrix.set((matrix) => mat4.rotate(matrix, matrix, 0.01 / (index + 1), [0, 0, 1])))
})
