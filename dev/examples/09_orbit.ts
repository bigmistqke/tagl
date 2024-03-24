import { mat4, vec3 } from 'gl-matrix'
import { atom } from 'src/core'
import { Scene, Sphere, getRayFromCamera } from 'world'
import { BoundingSphere } from 'world/bounds'
import { orbit } from 'world/controls'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = new Scene(canvas)
scene.autosize()
scene.perspective.set((matrix) => mat4.perspective(matrix, 190, scene.canvas.width / scene.canvas.height, 0.1, 1000))
scene.camera.set((camera) => mat4.translate(camera, camera, [0, 0, -2]))

const hit = atom(false)
hit.subscribe((hit) => {
  if (hit) {
    sphere.shape.color.set([1, 0, 0])
  } else {
    sphere.shape.color.set([0, 1, 0])
  }
})

const sphere = new Sphere({
  color: vec3.fromValues(0, 1, 0),
  matrix: mat4.create(),
  radius: 0.5,
  segments: 6,
  rings: 6,
  // mode: 'POINTS',
})

sphere.bind(scene)
const bounds = new BoundingSphere(vec3.create(), 0.5)

orbit(scene, { near: 0.1, initialRadius: 0.2 })

canvas.addEventListener('mousemove', (e) => {
  const ray = getRayFromCamera(e, canvas, scene)
  hit.set(bounds.rayIntersects(ray))
})
