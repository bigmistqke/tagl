import { mat4 } from 'gl-matrix'
import opentype from 'opentype.js'
import { createScene } from 'world'
import { createCharacter } from 'world/text'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = createScene(canvas)
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
  const char = createCharacter({
    font,
    character: 'a',
    matrix,
    color: [0, 1, 0],
  })

  char.bind(scene)

  setTimeout(() => {
    char.character.set('b')
    char.matrix.set((matrix) => mat4.translate(matrix, matrix, [5, 0, 0]))
  }, 1000)
})
