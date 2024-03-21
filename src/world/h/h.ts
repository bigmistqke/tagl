import { Atom } from '@tagl/core'
import { Shape } from '..'

export const h = <T extends new (...args: any[]) => Shape, TChildren extends (Shape | Atom<Shape | undefined>)[]>(
  Constructor: T,
  props: ConstructorParameters<T>[0],
  ...children: TChildren
): InstanceType<T> => {
  const shape = new Constructor(props) as InstanceType<T>
  console.log('shape is ', shape)
  children.forEach((child) => {
    if (child instanceof Atom) {
      let previous = child.get()?.bind(shape)
      child.subscribe((child) => {
        if (previous !== child) {
          if (previous) {
            previous.unbind()
          }
          if (child) {
            child.bind(shape)
          }
        }
        previous = child
      })
    } else {
      child.bind(shape)
    }
  })
  return shape
}
