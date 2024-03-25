import { Atom, Effect } from '@tagl/core'
import { Node3D } from '..'

export const h = <
  T extends (new (...args: any[]) => Node3D) | ((...args: any[]) => Node3D),
  const TChildren extends (Node3D | Atom<Node3D | undefined>)[]
>(
  Constructor: T,
  props: T extends new (...args: any[]) => Node3D ? ConstructorParameters<T>[0] : Parameters<T>[0],
  ...children: TChildren
): T extends new (...args: any[]) => any ? InstanceType<T> : ReturnType<T> => {
  let shape: any

  if (typeof Constructor === 'function') {
    // Directly checking if Constructor is a subclass of Node3D might not be straightforward,
    // so we differentiate based on expected input: class vs. function.
    // Since you know functional components don't directly extend Node3D, you can use this assumption.

    // Assuming Node3D is available in this scope. Adjust as necessary.
    if (Constructor.prototype instanceof Node3D || Constructor === Node3D) {
      // Handle as class constructor
      shape = new (Constructor as typeof Node3D)(props) as InstanceType<T>
    } else {
      // Handle as functional component
      shape = (Constructor as (props: {}) => Node3D)(props) as ReturnType<T>
    }
  } else {
    throw new Error('Constructor must be a class or function')
  }

  children.forEach((child) => {
    if (child instanceof Atom) {
      let previous = child.get()?.bind(shape)
      new Effect([child], ([child]) => {
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
    } else if (child instanceof Node3D) {
      child.bind(shape)
    }
  })
  return shape
}
