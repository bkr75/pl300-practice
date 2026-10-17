import { en } from './en'

/**
 * All user-facing strings live in ./en.ts. To translate, add a sibling file
 * (for example fr.ts) with the same keys and select it in `strings` below.
 */
const strings = en

export type StringKey = keyof typeof en
type Vars = Record<string, string | number>

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`))
}

export function t(key: StringKey, vars?: Vars): string {
  return interpolate(strings[key], vars)
}

/** Keys that have `_one` and `_other` variants. */
export type PluralKey = Extract<StringKey, `${string}_other`> extends `${infer B}_other` ? B : never

export function tn(base: PluralKey, count: number, vars?: Vars): string {
  const key = `${base}_${count === 1 ? 'one' : 'other'}` as StringKey
  return interpolate(strings[key], { count, ...vars })
}
