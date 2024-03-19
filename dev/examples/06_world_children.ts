import { mat4, vec3 } from 'gl-matrix'
import { atom } from 'src/core'
import { Disc, createDisc, createScene } from 'world'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = createScene(canvas)
scene.autosize()
scene.camera.set((camera) => mat4.translate(camera, camera, [0, 0, -5]))

let previousDisc: Disc

const color = atom(vec3.fromValues(0, 1, 0))

const arm = Array.from({ length: 4000 }).map((_, index) => {
  const matrix = mat4.create()
  mat4.translate(matrix, matrix, [1, 0, 0])
  mat4.scale(matrix, matrix, [1, 1, 1])

  const disc = createDisc({
    color,
    matrix,
    radius: 5,
    segments: 4,
  })

  if (previousDisc) {
    disc.bind(previousDisc)
  } else {
    disc.bind(scene)
    mat4.scale(matrix, matrix, [0.125, 0.125, 0.125])
  }
  previousDisc = disc
  return disc
})

const axis = [0, 0, 1] as const
let start = true
scene.onLoop(() => {
  for (let index = start === true ? 0 : 5; index < arm.length; index++) {
    arm[index]!.matrix.set((matrix) => mat4.rotate(matrix, matrix, 0.01 / (index + 1), axis))
  }
  start = false
})

const colors: [number, number, number][] = [
  [0, 1, 0],
  [1, 0, 0],
]
let toggle: 0 | 1 = 0

setInterval(() => {
  toggle++
  color.set((color) => vec3.set(color, ...colors[toggle % 2]!))
}, 1000)
