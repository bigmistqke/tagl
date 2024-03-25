import { mat4, vec3 } from 'gl-matrix'

import { Atom, atomize, memo } from '@tagl/core'
import { Scene, Sphere } from '@tagl/world'
import { orbit } from '@tagl/world/controls'
import { h, morph, show } from '@tagl/world/h'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = new Scene(canvas)
scene.autosize()
scene.perspective.set((matrix) =>
  mat4.perspective(matrix, 190, scene.canvas.width / scene.canvas.height, 0.1, 1000)
)
orbit(scene, { near: 0.1, initialRadius: 0.2 })

const each = new Atom([0, 1, 2, 3])
const when = new Atom(true)

const CustomSphere = (props: { radius: number }) => {
  const radius = atomize(props.radius)
  return h(Sphere, {
    color: vec3.fromValues(0, 0, 1),
    matrix: mat4.create(),
    radius,
    segments: 6,
    rings: 6,
    mode: 'POINTS',
  })
}

h(
  CustomSphere,
  {
    radius: 3,
  },
  show(
    { when },
    morph({
      from: each,
      to: (value) =>
        h(Sphere, {
          matrix: memo(
            [value],
            ([value], matrix) => mat4.fromTranslation(matrix, vec3.fromValues(0, value / 10, 0)),
            mat4.create()
          ),
          color: vec3.fromValues(0, 1, 0),
          radius: 0.5,
          segments: 6,
          rings: 6,
        }),
    })
  )
).bind(scene)

setInterval(() => {
  each.set((each) => {
    each[0] += 0.01
    return each
  })
}, 1000 / 60)

setInterval(() => {
  when.set((when) => !when)
}, 1000)
