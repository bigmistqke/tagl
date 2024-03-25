import { mat4, vec3 } from 'gl-matrix'

import { Atom, atomize, batch, memo } from '@tagl/core'
import { Scene, Sphere } from '@tagl/world'
import { orbit } from '@tagl/world/controls'
import { Morph, Show, h } from '@tagl/world/h'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = new Scene(canvas)
scene.autosize()
scene.perspective.set((matrix) =>
  mat4.perspective(matrix, 190, scene.canvas.width / scene.canvas.height, 0.1, 1000)
)
orbit(scene, { near: 0.1, initialRadius: 0.2 })

const AMOUNT = 1

const each = new Atom<[number, number][][]>(
  Array.from({ length: AMOUNT }).map((_, i) => Array.from({ length: AMOUNT }).map((_, j) => [i, j]))
)
const when = new Atom(true)

const CustomSphere = (props: { radius: number }) => {
  const radius = atomize(props.radius)
  return (
    <Sphere
      color={vec3.fromValues(0, 0, 1)}
      matrix={mat4.create()}
      radius={radius}
      segments={6}
      rings={6}
      mode="POINTS"
    />
  )
}

;(
  <CustomSphere radius={3}>
    <Show when={when}>
      <Morph
        from={each}
        to={(row) => (
          <Morph
            from={row}
            to={(value) => (
              <Sphere
                color={vec3.fromValues(0, 1, 0)}
                matrix={memo(
                  [value],
                  ([value], matrix) =>
                    mat4.fromTranslation(matrix, vec3.fromValues(value[0] / 10, value[1] / 10, 0)),
                  mat4.create()
                )}
                radius={0.5}
                segments={6}
                rings={6}
                mode="TRIANGLES"
              />
            )}
          />
        )}
      />
    </Show>
  </CustomSphere>
).bind(scene)

setTimeout(() => {
  batch(() => {
    const now = performance.now()
    each.set((each) => {
      for (let i = 0; i < each.length; i++) {
        for (let j = 0; j < each[i]!.length; j++) {
          each[i]![j]![0] = Math.sin(now / 1000) * (i - AMOUNT / 2) + i - AMOUNT / 2
          each[i]![j]![1] = Math.sin(now / 1000) * (j - AMOUNT / 2) + j - AMOUNT / 2
        }
      }
      return each
    })
  })
}, 3000)
