import { Atom, Effect } from '@tagl/core'
import { Node3D } from '..'
import { Fragment } from './fragment'

type Events = Record<`on${string}`, Event>
type Attributes = Record<string, any>

const createHTMLElement = (type: string, props: Events & Attributes) => {
  const element = document.createElement(type)
  for (const type in props) {
    if (type.slice(0, 2) === 'on') {
      element.addEventListener(type.slice(2).toLowerCase(), props[type])
    } else {
      if (props[type] instanceof Atom) {
        new Effect([props[type]!], ([value]) => element.setAttribute(type, value))
      } else {
        element.setAttribute(type, props[type])
      }
    }
  }
  return element
}

export const h = <
  T extends (new (...args: any[]) => Node3D) | ((...args: any[]) => Node3D | string) | string,
  const TChildren extends (Node3D | string | HTMLElement | Atom<Node3D | undefined>)[]
>(
  Constructor: T,
  props: T extends new (...args: any[]) => Node3D
    ? ConstructorParameters<T>[0]
    : T extends (...args: any[]) => Node3D
    ? Parameters<T>[0]
    : Record<string, any>,
  ...children: TChildren
): T extends new (...args: any[]) => any ? InstanceType<T> : ReturnType<T> => {
  let shape: any

  if (typeof Constructor === 'function') {
    if (Constructor.prototype instanceof Fragment || Constructor === Fragment) {
      return children
    } else if (Constructor.prototype instanceof Node3D || Constructor === Node3D) {
      // Handle as class constructor
      shape = new (Constructor as typeof Node3D)(props) as InstanceType<T>
    } else {
      // Handle as functional component
      shape = (Constructor as (props: {}) => Node3D)(props) as ReturnType<T>
    }
  } else {
    shape = createHTMLElement(Constructor, props)
  }

  if (shape instanceof HTMLElement) {
    children.forEach((child) => {
      if (child instanceof HTMLElement) {
        shape.appendChild(child)
      } else if (Array.isArray(child)) {
        child.forEach((child) => {
          const fragment = document.createDocumentFragment()
          fragment.append(child)
          shape.appendChild(fragment)
        })
      } else if (child instanceof Atom) {
        const textNode = document.createTextNode(child.get())
        shape.appendChild(textNode)

        new Effect([child], (value) => {
          textNode.textContent = value
        })
      } else if (typeof child === 'string') {
        const textNode = document.createTextNode(child)
        shape.appendChild(textNode)
      }
    })

    return shape
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
