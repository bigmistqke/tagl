import { Atom, subscribe } from '@tagl/core'
function createTextNode(value: string) {
  return document.createTextNode(value)
}

function createReactiveTextNode(atom: Atom<string>) {
  const node = document.createTextNode(atom.get())
  atom.subscribe((newValue: string | null) => {
    node.nodeValue = newValue
  })
  return node
}

export function html(
  strings: TemplateStringsArray,
  ...values: (Atom<any> | Handler | Prop | string | DocumentFragment)[]
) {
  const template = document.createElement('template')

  template.innerHTML = strings.reduce((acc, str, i) => {
    const value = values[i]
    let dynamicPart =
      value instanceof Handler || value instanceof Prop
        ? ` data-${i}="true" `
        : value instanceof Atom
        ? `<span data-dynamic="${i}"></span>`
        : value

    return acc + str + dynamicPart
  }, '')

  const content = document.importNode(template.content, true)

  values.forEach((value, index) => {
    if (value instanceof Handler || value instanceof Prop) {
      const element = content.querySelector(`[data-${index}="true"]`)
      element?.removeAttribute(`data-${index}`)
      if (element) value.bind(element)
    } else if (value instanceof Atom) {
      const placeholder = content.querySelector(`span[data-dynamic="${index}"]`)
      if (placeholder) {
        const parentNode = placeholder.parentNode!
        let newNode = value instanceof Atom ? createReactiveTextNode(value) : createTextNode(value)
        parentNode.replaceChild(newNode, placeholder)
      }
    }
  })

  return content
}

// Define a type for the function returned by accessing properties on the proxy
type PropCreator = <T>(atom: Atom<T> | T) => Prop

// Update the proxy to explicitly declare its return type as PropCreator
export const prop = new Proxy({} as Record<string, PropCreator>, {
  get(target, type: string): PropCreator {
    // Explicitly typing the returned function
    return <T>(atom: Atom<T>): Prop => {
      return new Prop(type, atom)
    }
  },
})

class Prop {
  constructor(public type: string, public value: Atom<any> | any) {}
  bind(element: Element) {
    if (this.value instanceof Atom) {
      subscribe([this.value], ([value]) => element.setAttribute(this.type, value))
    } else {
      element.setAttribute(this.type, this.value)
    }
  }
}

type Events = {
  click: (callback: (event: MouseEvent) => void) => Handler
  mousedown: (callback: (event: MouseEvent) => void) => Handler
  change: (callback: (event: Event) => void) => Handler
}

export const on = new Proxy({} as Events, {
  get(target, property: string) {
    return (callback: () => any) => new Handler(property, callback)
  },
})

let count = 0
class Handler {
  id: number
  constructor(public type: string, public callback: (...args: any[]) => void) {
    this.id = count++
  }
  bind(element: Element) {
    element.addEventListener(this.type, this.callback.bind(this))
  }
}
