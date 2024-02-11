import { TupleOf } from 'src/core/types'

export type Vector2 = TupleOf<number, 2>
export type Vector3 = TupleOf<number, 3>

export type Pose = {
  position: Vector3
  rotation: Vector3
  scale: Vector3
}
