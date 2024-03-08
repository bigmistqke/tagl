import { mat4 } from 'gl-matrix'
import { glsl } from 'src/core'
import { createCube, createScene } from 'world'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = createScene(canvas)
scene.autosize()

//prettier-ignore
const cube = createCube({
  color: new Float32Array([1, 0, 0]),
  matrix: mat4.create(),
  fragment: ({color}) => glsl`#version 300 es
    precision highp float;
    out vec4 color;
    void main(void) {
      color = vec4(${color}, 1.);
    }`
})
cube.color.subscribe((value) => {
  console.log('value', value)
})

scene.camera.set((camera) => mat4.translate(camera, camera, [0, 0, -1]) as Float32Array)
scene.add(cube)

setTimeout(() => {
  cube.color.set((color) => {
    color[0] = 0
    color[1] = 1
    color[2] = 0
    return color
  })
}, 1000)

scene.onLoop((time) => {
  cube.matrix.set((matrix) => {
    mat4.rotateX(matrix, matrix, 0.01 * Math.sin(time / 1000))
    mat4.rotateY(matrix, matrix, 0.01)
    return matrix
  })
})
