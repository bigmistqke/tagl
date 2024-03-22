import { mat4, vec3 } from 'gl-matrix'

import { Atom, atomize, memo } from '@tagl/core'
import { Scene, Sphere } from '@tagl/world'
import { orbit } from '@tagl/world/controls'
import { For, h } from '@tagl/world/h'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = new Scene(canvas)
scene.autosize()
scene.perspective.set((matrix) => mat4.perspective(matrix, 190, scene.canvas.width / scene.canvas.height, 0.1, 1000))
orbit(scene, { near: 0.1, initialRadius: 0.2 })

const matrix2 = new Atom(mat4.fromTranslation(mat4.create(), [0, 0.01, 0]))
const each = atomize([0, 1, 2, 3])

h(
  Sphere,
  {
    color: vec3.fromValues(0, 0, 1),
    matrix: mat4.create(),
    radius: 0.5,
    segments: 6,
    rings: 6,
    mode: 'POINTS',
  },
  h(For<number[], Sphere>, {
    each,
    shape: (value) =>
      h(Sphere, {
        matrix: memo([value], (value) => mat4.fromTranslation(mat4.create(), vec3.fromValues(0, value / 10, 0))),
        color: vec3.fromValues(0, 1, 0),
        radius: 0.5,
        segments: 6,
        rings: 6,
      }),
  })
).bind(scene)

setTimeout(() => {
  each.set((each) => {
    console.log('add')
    // each.push(4)
    each[0] = -2
    return each
  })
  /* setTimeout(() => {
    each.set((each) => {
      console.log('remove')
      each.pop()
      return each
    })
  }, 2000) */
}, 2000)
