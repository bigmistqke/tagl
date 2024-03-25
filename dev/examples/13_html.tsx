import { mat4, vec3 } from 'gl-matrix'

import { Atom, atomize } from '@tagl/core'
import { Scene, Sphere } from '@tagl/world'
import { orbit } from '@tagl/world/controls'
import { Fragment, Match, Morph, Show, h } from '@tagl/world/h'
import { html, on, prop } from '@tagl/world/html'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = new Scene(canvas)
scene.autosize()
scene.perspective.set((matrix) =>
  mat4.perspective(matrix, 190, scene.canvas.width / scene.canvas.height, 0.1, 1000)
)
orbit(scene, { near: 0.1, initialRadius: 0.2 })

// @prettier-ignore
const TETROMINO_SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],

  J: [
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 0],
  ],
  L: [
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 1],
  ],
}

const when = new Atom(true)
const type = new Atom('I')

const Tetromino = (props: {
  type: keyof typeof TETROMINO_SHAPES | Atom<keyof typeof TETROMINO_SHAPES>
}) => (
  <Morph
    from={new Atom([atomize(props.type)], ([type]) => TETROMINO_SHAPES[type])}
    to={(column, x) => (
      <Morph
        from={column}
        to={(value, y) => (
          <Show when={value}>
            <Sphere
              color={vec3.fromValues(0, 1, 0)}
              matrix={mat4.fromTranslation(mat4.create(), [y / 10, -x / 10, 0])}
              radius={0.5}
              segments={6}
              rings={6}
              mode="TRIANGLES"
            />
          </Show>
        )}
      />
    )}
  />
)

;(
  <Show when={when}>
    <Match
      when={type}
      cases={{
        I: <Tetromino type="I" />,
        O: <Tetromino type="O" />,
        T: <Tetromino type="T" />,
        S: <Tetromino type="S" />,
        Z: <Tetromino type="Z" />,
        L: <Tetromino type="L" />,
        J: <Tetromino type="J" />,
      }}
    />
  </Show>
).bind(scene)

const text = new Atom([when], ([when]) => (when ? 'hide' : 'show'))

const className = new Atom('red')
// setInterval(() => className.set((className) => (className === 'red' ? 'blue' : 'red')), 1000)

document.body.appendChild(html`
  <div style="position: absolute; z-index:1; top: 0px; left: 0px;">
    <button ${on.click(() => when.set((when) => !when))}>${text}</button>
    <select
      ${prop.class!(className)}
      ${on.change((event) => {
        type.set(event.currentTarget!.value as keyof typeof TETROMINO_SHAPES)
      })}
    >
      ${Object.keys(TETROMINO_SHAPES)
        .map((char) => `<option>${char}</option>`)
        .join('\n')}
    </select>
  </div>
`)
