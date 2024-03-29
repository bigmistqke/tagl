import { Node3D } from '@tagl/world/primitives'

type Events = Record<`on${string}`, (event: Event) => void>
type Attributes = Record<string, any>
type HTML = Events & Attributes & { children?: JSX.Element | JSX.Element[] | string | number }

declare global {
  declare namespace JSX {
    type IntrinsicElements = Record<string, HTML>
    interface Element extends Node3D {}
  }
}
