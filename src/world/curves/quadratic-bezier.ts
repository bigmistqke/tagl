import { mat4, vec3 } from 'gl-matrix'

import { Accessor } from '@tagl/core/types'

import { Vector2 } from '@tagl/world/types'

export class QuadraticBezier {
  _curvatureVector: Accessor<vec3>
  p0: Float32Array
  p1: Float32Array
  p2: Float32Array

  constructor(buffer: Float32Array) {
    this.p0 = buffer.subarray(0, 3)
    this.p1 = buffer.subarray(4, 6)
    this.p2 = buffer.subarray(7, 9)
    const temp1 = vec3.create()
    const temp2 = vec3.create()
    this._curvatureVector = () =>
      vec3.subtract(temp1, vec3.subtract(temp1, vec3.scale(temp1, this.p2, 2), vec3.scale(temp2, this.p1, 4)), this.p0)
  }

  get curvatureVector() {
    return this._curvatureVector()
  }

  getPositionAt(t: number) {
    const oneMinusT = 1 - t
    return vec3.fromValues(
      oneMinusT * oneMinusT * this.p0[0]! + 2 * oneMinusT * t * this.p1[0]! + t * t * this.p2[0]!,
      oneMinusT * oneMinusT * this.p0[1]! + 2 * oneMinusT * t * this.p1[1]! + t * t * this.p2[1]!,
      oneMinusT * oneMinusT * this.p0[2]! + 2 * oneMinusT * t * this.p1[2]! + t * t * this.p2[2]!
    )
  }
  getTangentAt(t: number) {
    const tangent = vec3.fromValues(
      2 * (1 - t) * (this.p1[0]! - this.p0[0]!) + 2 * t * (this.p2[0]! - this.p1[0]!),
      2 * (1 - t) * (this.p1[1]! - this.p0[1]!) + 2 * t * (this.p2[1]! - this.p1[1]!),
      2 * (1 - t) * (this.p1[2]! - this.p0[2]!) + 2 * t * (this.p2[2]! - this.p1[2]!)
    )
    return vec3.normalize(tangent, tangent)
  }
  getNormalAndBiNormalAt(t: number) {
    const normalizedTangent = this.getTangentAt(t)
    // Calculate the second derivative (curvature vector) of the Bézier curve

    // Calculate the normal vector as the cross product of tangent and curvature vector
    let normal = vec3.cross(vec3.create(), normalizedTangent, this.curvatureVector)
    vec3.normalize(normal, normal)

    // Calculate the binormal vector as the cross product of tangent and normal
    let binormal = vec3.cross(vec3.create(), normalizedTangent, normal)
    vec3.normalize(binormal, binormal)

    return { normal, binormal }
  }

  getMatrixAt(t: number, matrix = mat4.create()): mat4 {
    const { normal, binormal } = this.getNormalAndBiNormalAt(t)
    const position = this.getPositionAt(t)

    // Calculate the tangent vector as cross product of normal and binormal
    const tangent = vec3.cross(vec3.create(), normal as vec3, binormal as vec3)

    // Create a matrix and set rotation part using normal, binormal, and tangent
    matrix[0] = normal[0]
    matrix[1] = normal[1]
    matrix[2] = normal[2]
    matrix[4] = binormal[0]
    matrix[5] = binormal[1]
    matrix[6] = binormal[2]
    matrix[8] = tangent[0]
    matrix[9] = tangent[1]
    matrix[10] = tangent[2]

    // Add translation
    matrix[12] = position[0]
    matrix[13] = position[1]
    matrix[14] = position[2]

    return matrix
  }
}

/**********************************************************************************/
/*                               ADAPTIVE 2D BEZIERS                              */
/**********************************************************************************/

const midpoint = (p1: Vector2, p2: Vector2): Vector2 => [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]

function isFlatEnoughQuadratic(start: Vector2, control: Vector2, end: Vector2, flatness: number): boolean {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const d = Math.abs((control[0] - start[0]) * dy - (control[1] - start[1]) * dx)
  return d <= flatness
}

function isFlatEnoughCubic(
  start: Vector2,
  control1: Vector2,
  control2: Vector2,
  end: Vector2,
  flatness: number
): boolean {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const d1 = Math.abs((control1[0] - start[0]) * dy - (control1[1] - start[1]) * dx)
  const d2 = Math.abs((control2[0] - start[0]) * dy - (control2[1] - start[1]) * dx)
  return Math.max(d1, d2) <= flatness
}

export function adaptiveSubdivideQuadraticBezierPoints(
  start: Vector2,
  control: Vector2,
  end: Vector2,
  flatness: number = 1,
  points: number[] = [...start]
): number[] {
  if (isFlatEnoughQuadratic(start, control, end, flatness)) {
    points.push(...end)
    return points
  }

  const midPoint1 = midpoint(start, control)
  const midPoint2 = midpoint(control, end)
  const newControl = midpoint(midPoint1, midPoint2)

  adaptiveSubdivideQuadraticBezierPoints(start, midPoint1, newControl, flatness, points)
  adaptiveSubdivideQuadraticBezierPoints(newControl, midPoint2, end, flatness, points)

  return points
}

export function adaptiveSubdivideCubicBezierPoints(
  start: Vector2,
  control1: Vector2,
  control2: Vector2,
  end: Vector2,
  flatness: number = 1,
  points: number[] = [...start]
): number[] {
  if (isFlatEnoughCubic(start, control1, control2, end, flatness)) {
    points.push(...end)
    return points
  }

  const midPoint1 = midpoint(start, control1)
  const midPoint2 = midpoint(control1, control2)
  const midPoint3 = midpoint(control2, end)
  const midPoint4 = midpoint(midPoint1, midPoint2)
  const midPoint5 = midpoint(midPoint2, midPoint3)
  const newStart = midpoint(midPoint4, midPoint5)

  adaptiveSubdivideCubicBezierPoints(start, midPoint1, midPoint4, newStart, flatness, points)
  adaptiveSubdivideCubicBezierPoints(newStart, midPoint5, midPoint3, end, flatness, points)

  return points
}
