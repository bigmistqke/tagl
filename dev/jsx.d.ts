import { Root } from '@tagl/world/h'
import { Node3D } from '@tagl/world/primitives'

declare global {
  declare namespace JSX {
    interface IntrinsicElements {
      root: ConstructorParameters<typeof Root>[0]
    }
    interface Element extends Node3D {}
  }
}
