import { mat4, vec3, vec4 } from 'gl-matrix'

import { Scene } from '@tagl/world'

export function getRayFromCamera(e: MouseEvent, canvas: HTMLCanvasElement, scene: Scene) {
  // Step 1: Convert mouse coordinates to NDC
  const normalizedDeviceCoordinates = {
    x: (2.0 * e.clientX) / canvas.width - 1.0,
    y: 1.0 - (2.0 * e.clientY) / canvas.height,
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
  return {
    origin,
    direction,
  }
}
