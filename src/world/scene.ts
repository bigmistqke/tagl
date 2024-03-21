import { mat4, vec3, vec4 } from 'gl-matrix'

import { GL, Pipeline, uniform } from '@tagl/core'
import { Uniform } from '@tagl/core/tokens'
import { Origin3D } from '@tagl/world/scene-graph'

export class Scene extends GL {
  camera = uniform.mat4(mat4.create())
  node = new Origin3D(this)
  perspective: Uniform<mat4>
  pipeline = new Pipeline(this)

  constructor(public canvas: HTMLCanvasElement) {
    super(canvas)
    this.perspective = uniform.mat4(this._perspective())
    this.onResize(() => this.perspective.set(this._perspective))
    this.pipeline.add(this.node.update.bind(this.node)).add(super.render.bind(this))
  }

  render() {
    this.pipeline.run()
  }

  private _perspective = (matrix?: mat4) =>
    mat4.perspective(
      matrix || mat4.create(),
      Math.PI / 2,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      1000
    )

  castRayFromCamera(e?: MouseEvent | { x: number; y: number }) {
    return getRayFromCamera(this, e instanceof MouseEvent ? { x: e.clientX, y: e.clientY } : e ? e : { x: 0, y: 0 })
  }
}

class Ray {
  constructor(public origin: vec3, public direction: vec3) {}
}

function getRayFromCamera(scene: Scene, coord?: { x: number; y: number }) {
  const canvas = scene.canvas
  // Step 1: Convert mouse coordinates to NDC
  const normalizedDeviceCoordinates = coord
    ? {
        x: (2.0 * coord.x) / canvas.width - 1.0,
        y: 1.0 - (2.0 * coord.y) / canvas.height,
      }
    : {
        x: 0.5,
        y: 0.5,
      }

  // Step 2: Compute ray in view space
  const inverseProjectionMatrix = mat4.invert(mat4.create(), scene.perspective.get())
  const ndcFar = vec4.fromValues(normalizedDeviceCoordinates.x, normalizedDeviceCoordinates.y, 1, 1)

  const viewFar = vec4.transformMat4(vec4.create(), ndcFar, inverseProjectionMatrix)
  vec4.scale(viewFar, viewFar, 1.0 / viewFar[3])
  const rayDirectionInViewSpace = vec3.fromValues(viewFar[0], viewFar[1], viewFar[2])

  // Step 3: Transform ray to world space
  const inverseViewMatrix = mat4.invert(mat4.create(), scene.camera.get())
  const direction = vec3.transformMat4(vec3.create(), rayDirectionInViewSpace, inverseViewMatrix)
  vec3.normalize(direction, direction)

  // The ray origin is the camera's position in the world, which can be directly extracted from the inverse view matrix
  const origin = vec3.fromValues(inverseViewMatrix[12], inverseViewMatrix[13], inverseViewMatrix[14])

  return new Ray(origin, direction)
}
