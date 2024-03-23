import { Node3D } from '@tagl/world/primitives'

declare global {
  declare namespace JSX {
    interface IntrinsicElements {}
    interface Element extends Node3D {}
  }
}
