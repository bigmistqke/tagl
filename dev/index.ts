import { Scene } from '@tagl/world'
import { Character } from '@tagl/world/text'
import { mat4 } from 'gl-matrix'
import opentype from 'opentype.js'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = new Scene(canvas)
scene.autosize()
scene.camera.set((camera) => {
  mat4.translate(camera, camera, [0, 0, -5])
  mat4.rotate(camera, camera, Math.PI, [0, 1, 0])
  return camera
})

const font = opentype.load('./GeistMono-Regular.otf')

const matrix = mat4.create()
mat4.rotate(matrix, matrix, Math.PI, [0, 0, 1])
mat4.translate(matrix, matrix, [-2, 2, 0])

font.then((font) => {
  const character = new Character({
    font,
    value: 'a',
    matrix,
    color: [0, 1, 0],
  })

  character.bind(scene)

  setTimeout(() => {
    character.matrix.set((matrix) => mat4.translate(matrix, matrix, [5, 0, 0]))
    character.value.set('b')
  }, 1000)
})
