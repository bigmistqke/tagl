import { Node3D, Scene } from '@tagl/world'

let shouldStop = false
const stop = () => {
  shouldStop = true
}

let shouldPreventBranch = false
const preventBranch = () => {
  shouldPreventBranch = true
}

const children: Node3D[] = []

export const traverseChildren = (
  node: Node3D | Scene,
  callback: (object3D: Node3D, stop: () => void, preventBranch: () => void) => void
) => {
  Array.prototype.push.apply(children, node.children.get())

  shouldStop = false

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!
    shouldPreventBranch = false
    callback(child, stop, preventBranch)
    if (shouldStop) break
    if (!shouldPreventBranch) {
      Array.prototype.push.apply(children, child.children.get())
    }
  }

  children.length = 0
}
