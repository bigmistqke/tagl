import { mat4 } from 'gl-matrix'
import { glsl } from 'src/core'
import { createPlane, createScene } from 'world'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const scene = createScene(canvas)
scene.autosize()

//prettier-ignore
const plane = createPlane({
  color: new Float32Array([1, 0, 0]),
  matrix: mat4.create() as Float32Array,
  fragment: ({color}) => glsl`#version 300 es
    precision highp float;
    out vec4 color;
    void main(void) {
      color = vec4(${color}, 1.);
    }`
})
plane.color.subscribe((value) => {
  console.log('value', value)
})

scene.camera.set((camera) => mat4.translate(camera, camera, [0, 0, -1]))
scene.add(plane)

setTimeout(() => {
  plane.color.set((color) => {
    color[0] = 0
    color[1] = 1
    color[2] = 0
    return color
  })
}, 1000)
