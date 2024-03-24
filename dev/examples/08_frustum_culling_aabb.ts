import { mat4, vec3 } from 'gl-matrix'
import { atom } from 'src/core'
import { AABB, Disc, Frustum, createDisc, createScene } from 'world'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = createScene(canvas)
scene.autosize()
scene.camera.set((camera) => mat4.translate(camera, camera, [0, 0, -5]))

let previousDisc: Disc

const color = atom(vec3.fromValues(0, 1, 0))

const arm = Array.from({ length: 10 }).map((_, index) => {
  const matrix = mat4.create()
  mat4.translate(matrix, matrix, [1, 0, 0])

  const disc = createDisc<{ bounds: AABB }>({
    color,
    matrix,
    radius: 5,
    segments: 4,
  })
  disc.shape.data.bounds = new AABB(disc)

  if (previousDisc) {
    disc.bind(previousDisc)
  } else {
    disc.bind(scene)
    // mat4.scale(matrix, matrix, [0.125, 0.125, 0.125])
  }
  previousDisc = disc
  return disc
})

const axis = [0, 0, 1] as const
let start = true

const frustum = new Frustum(scene.camera, scene.perspective)

scene.onBeforeRender(() => {
  arm.forEach((disc) => {
    disc.shape.program!.visible = disc.shape.data.bounds!.intersectsFrustum(frustum)
  })
})

scene.onLoop(() => {
  for (let index = 0; index < arm.length; index++) {
    arm[index]!.matrix.set((matrix) => mat4.rotate(matrix, matrix, 0.001 / (index + 1), axis))
  }
  start = false
})
