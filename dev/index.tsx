import { mat4 } from 'gl-matrix'

import { Atom } from '@tagl/core'
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

const type = new Atom('I')

const unwrap = (input: any | Atom<any[]>): any => {
  const result = input instanceof Atom ? input.get() : input
  return Array.isArray(result) ? result.map((v) => (v instanceof Atom ? unwrap(v) : v)) : result
}

const from = new Atom(
  [type],
  ([type]) => TETROMINO_SHAPES[type as unknown as keyof typeof TETROMINO_SHAPES]
)

;(
  <Morph
    from={from}
    to={(column, x) => (
      <Morph
        from={column}
        to={(when, y) => (
          <Show when={when}>
            <Sphere
              visible={true}
              radius={0.1}
              matrix={mat4.fromTranslation(mat4.create(), [y / 30, x / 30, 0])}
            />
          </Show>
        )}
      />
    )}
  />
).bind(scene)

document.body.appendChild(
  (
    <div style="position: absolute; z-index:1; top: 0px; left: 0px; padding: 5px; display: flex; gap: 5px;">
      <label>tetromino:</label>
      <select
        onChange={(event) => type.set(event.currentTarget!.value as keyof typeof TETROMINO_SHAPES)}
      >
        {Object.keys(TETROMINO_SHAPES).map((char) => (
          <option>{char}</option>
        ))}
      </select>
    </div>
  ) as unknown as HTMLDivElement
)
