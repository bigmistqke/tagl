import { Node3D, Origin3D } from '..'

let shouldStop = false
const stop = () => {
  shouldStop = true
}

export const traverseParent = (
  root: Node3D | Origin3D,
  callback?: (object3D: Node3D | Origin3D, stop: () => void) => false | void
) => {
  let currentNode: Node3D | Origin3D | undefined = root
  shouldStop = false

  while (!shouldStop && currentNode && !(currentNode instanceof Origin3D)) {
    if (callback?.(currentNode, stop) === false) {
      return
    }
    currentNode = 'parent' in currentNode ? currentNode.parent : undefined
  }

  return currentNode
}
