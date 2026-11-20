const { build } = require('esbuild')
const { mkdtempSync, readdirSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'insurance-product-tests-'))
  try {
    const tests = readdirSync(resolve(__dirname, '../tests')).filter((file) => file.endsWith('.test.ts'))
    if (!tests.length) throw new Error('没有找到产品接入测试')
    const outputFiles = []
    for (const test of tests) {
      const outfile = join(directory, test.replace(/\.ts$/, '.cjs'))
      await build({
        entryPoints: [resolve(__dirname, '../tests', test)],
        outfile,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        logLevel: 'silent',
        plugins: [{
          name: '小程序测试运行环境',
          setup(builder) {
            builder.onResolve({ filter: /^@tarojs\/taro$/ }, () => ({ path: 'taro', namespace: 'test-taro' }))
            builder.onLoad({ filter: /.*/, namespace: 'test-taro' }, () => ({
              contents: 'const taro = globalThis.__INSURANCE_TEST_TARO__ ||= {}; export default taro;',
              loader: 'js'
            }))
          }
        }]
      })
      outputFiles.push(outfile)
    }
    const result = spawnSync(process.execPath, ['--test', ...outputFiles], { stdio: 'inherit' })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
