import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

/** 在隔离的模块实例中注入微信 API，验证重新启动与异步卸载行为。 */
export function loadSourceModule<T>(path: string, modules: Record<string, unknown>): T {
  const source = readFileSync(resolve(process.cwd(), path), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText
  const exported = {}
  runInNewContext(compiled, {
    exports: exported,
    module: { exports: exported },
    require: (name: string) => {
      if (Object.prototype.hasOwnProperty.call(modules, name)) return modules[name]
      throw new Error(`测试缺少模块：${name}`)
    },
    console,
    setTimeout,
    clearTimeout
  })
  return exported as T
}
