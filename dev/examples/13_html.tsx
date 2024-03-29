import { mat4, vec3 } from 'gl-matrix'

import { Atom, atomize } from '@tagl/core'
import { Scene, Sphere } from '@tagl/world'
import { orbit } from '@tagl/world/controls'
import { Fragment, Morph, h } from '@tagl/world/h'
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
  T: [0, 1, 0],
  S: [0, 1, 1],
  Z: [1, 1, 0],
}

const when = new Atom(true)
const type = new Atom('I')
const text = new Atom([when], ([when]) => (when ? 'hide' : 'show'))
const segments = new Atom(7)
const className = new Atom('red')

const Tetromino = (props: {
  type: keyof typeof TETROMINO_SHAPES | Atom<keyof typeof TETROMINO_SHAPES>
}) => {
  const shape = new Atom([atomize(props.type)], ([type]) => TETROMINO_SHAPES[type])
  return (
    <Morph
      from={shape}
      to={(column, x) => (
        <Sphere
          color={vec3.fromValues(0, 1, 0)}
          matrix={mat4.fromTranslation(mat4.create(), [0 / 10, -x / 10, 0])}
          radius={0.5}
          segments={segments}
          rings={segments}
          mode="TRIANGLES"
        />
      )}
    />
  )
}

;(<Tetromino type={type} />).bind(scene)

// prettier-ignore
document.body.appendChild(html`
  <div style="position: absolute; z-index:1; top: 0px; left: 0px;">
    <button ${
      on.click(() => when.set((when) => !when))
    }>${
      text
    }</button>
    <input 
      type="number" 
      ${prop.value!(segments)} 
      ${on.input((e) => segments.set(+e.currentTarget?.value))}
    />
    <select
      ${prop.class!(className)}
      ${on.change((event) => type.set(event.currentTarget!.value as keyof typeof TETROMINO_SHAPES))}
    >
      ${Object.keys(TETROMINO_SHAPES)
        .map((char) => `<option>${char}</option>`)
        .join('\n')}
    </select>
  </div>
`)
