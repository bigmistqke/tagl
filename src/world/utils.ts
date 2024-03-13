import { Node3D, Origin3D } from '.'

export const traverseChildren = (root: Node3D, callback: (object3D: Node3D) => false | void) => {
  const stack: Node3D[] = [root]

  while (stack.length > 0) {
    let currentNode = stack.pop() // Removes and returns the last element of the stack

    if (currentNode && callback(currentNode) === false) {
      return
    }

    if (currentNode && currentNode.__.children) {
      for (let child of currentNode.__.children) {
        stack.push(child)
      }
    }
  }
}

export const traverseParent = (root: Node3D | Origin3D, callback?: (object3D: Node3D | Origin3D) => false | void) => {
  let currentNode: Node3D | Origin3D | undefined = root

  while (currentNode && !(currentNode instanceof Origin3D)) {
    if (callback?.(currentNode) === false) {
      return
    }
    currentNode = 'parent' in currentNode ? currentNode.parent : undefined
  }

  return currentNode
}
