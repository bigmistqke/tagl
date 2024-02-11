import type { Token } from './types'

export const compile = (
  strings: TemplateStringsArray,
  tokens: Token[],
  names: string[]
) => {
  const code = [
    ...strings.flatMap((string, index) => [string, names[index]!]),
  ].join('')

  const variables = Array.from(
    new Set(tokens.flatMap((token, index) => token?.compile(names[index]!)))
  ).join('\n')

  const precision = code.match(/precision.*;/)?.[0]
  if (precision) {
    const [version, body] = code.split(/precision.*;/)

    return {
      code: [version, precision, variables, body].join('\n'),
      parts: {
        version,
        precision,
        variables,
        body,
      },
    }
  }
  const version = code.match(/#version.*/)?.[0]
  const [pre, after] = code.split(/#version.*/)
  const body = after || pre
  return {
    code: [version, variables, body].join('\n'),
    parts: {
      version,
      variables,
      body,
    },
  }
}
