import { ReadonlyVec3, mat4, vec3 } from 'gl-matrix'

import { Frustum } from '@tagl/world/frustum'

export class BoundingSphere {
  scratch = vec3.create()
  radius: number

  constructor(private center = vec3.create(), radius = 1) {
    this.radius = radius * 0.1
  }

  set(center: ReadonlyVec3, radius: number) {
    vec3.copy(this.center, center)
    this.radius = radius * 0.1
  }

  setCenterFromMatrix(matrix: mat4) {
    //prettier-ignore
    vec3.set(
      this.center,
      matrix[12], // x translation
      matrix[13], // y translation
      matrix[14]  // z translation
    )
  }

  frustumIntersects(frustum: Frustum) {
    for (const plane of frustum.planes) {
      vec3.set(this.scratch, plane[0], plane[1], plane[2])
      const centerDistance = vec3.dot(this.scratch, this.center) + plane[3]
      if (centerDistance < -this.radius) {
        return false
      }
    }
    return true
  }

  rayIntersects(ray: { origin: vec3; direction: vec3 }) {
    // Ensure the direction is normalized
    const normalizedDirection = vec3.normalize(vec3.create(), ray.direction)

    // Compute the vector from the ray origin to the sphere's center
    const originToCenter = vec3.subtract(vec3.create(), this.center, ray.origin)

    // Calculate coefficients of the quadratic equation
    const a = 1 // since D is normalized
    const b = 2.0 * vec3.dot(normalizedDirection, originToCenter)
    const c = vec3.dot(originToCenter, originToCenter) - this.radius * this.radius

    // Calculate the discriminant
    const discriminant = b * b - 4 * a * c

    // If the discriminant is negative, there is no real root, and the ray does not intersect the sphere
    if (discriminant < 0) {
      return false
    }

    // If we reach here, there's at least one intersection point
    return true
  }
}
