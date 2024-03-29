import { mat4, vec4 } from 'gl-matrix'

import { Effect } from '@tagl/core'
import { Scene } from '@tagl/world'

export class Frustum {
  planes: vec4[] = null!

  constructor(scene: Scene) {
    new Effect([scene.camera, scene.perspective], ([camera, perspective]) => {
      this.planes = this.computeFrustumPlanes(camera, perspective)
    })
  }

  private computeFrustumPlanes(cameraMatrix: mat4, perspectiveMatrix: mat4): vec4[] {
    const viewProjectionMatrix = mat4.multiply(mat4.create(), perspectiveMatrix, cameraMatrix)
    const planes: vec4[] = []

    // Extract planes - the equations are derived from the viewProjectionMatrix
    planes.push(
      vec4.fromValues(
        viewProjectionMatrix[3] + viewProjectionMatrix[0],
        viewProjectionMatrix[7] + viewProjectionMatrix[4],
        viewProjectionMatrix[11] + viewProjectionMatrix[8],
        viewProjectionMatrix[15] + viewProjectionMatrix[12]
      )
    )
    planes.push(
      vec4.fromValues(
        viewProjectionMatrix[3] - viewProjectionMatrix[0],
        viewProjectionMatrix[7] - viewProjectionMatrix[4],
        viewProjectionMatrix[11] - viewProjectionMatrix[8],
        viewProjectionMatrix[15] - viewProjectionMatrix[12]
      )
    )
    // Repeat for other planes (left, right, top, bottom, near, far) and normalize them

    planes.forEach((plane, index) => {
      const norm = vec4.fromValues(plane[0], plane[1], plane[2], 0)
      vec4.normalize(norm, norm)
      norm[3] = plane[3]
      planes[index] = norm
    })

    return planes
  }
}
