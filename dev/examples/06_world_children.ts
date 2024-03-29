import { Disc, Scene } from '@tagl/world'
import { mat4, vec3 } from 'gl-matrix'
import { Atom } from 'src/core'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = new Scene(canvas)
scene.autosize()
scene.camera.set((camera) => mat4.translate(camera, camera, [0, 0, -5]))

let previousDisc: Disc | Scene = scene

const color = new Atom(vec3.fromValues(0, 1, 0))

const arm = Array.from({ length: 5000 }).map((_, index) => {
  const matrix = mat4.create()
  mat4.translate(matrix, matrix, [1, 0, 0])
  mat4.scale(matrix, matrix, [1, 1, 1])

  const disc = new Disc({
    color,
    matrix,
    radius: 5,
    segments: 8,
  })

  disc.bind(previousDisc)

  previousDisc = disc
  return disc
})
arm[0]?.localMatrix.set((matrix) => mat4.scale(matrix, matrix, [0.125, 0.125, 0.125]))

const axis = [0, 0, 1] as const

scene.onLoop(() => {
  for (let index = 0; index < arm.length; index++) {
    arm[index]!.localMatrix.set((matrix) => mat4.rotate(matrix, matrix, 0.005 / (index + 1), axis))
  }
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
