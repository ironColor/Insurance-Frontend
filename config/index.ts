import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import devConfig from './dev'
import prodConfig from './prod'

const config: UserConfigExport<'vite'> = {
  projectName: 'insurance-mini-program',
  date: '2026-09-03',
  designWidth: 750,
  deviceRatio: {
    375: 2,
    640: 2.34,
    750: 1,
    828: 1.81
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: {
    type: 'vite',
    prebundle: {
      enable: false
    }
  },
  cache: {
    enable: false
  },
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {}
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      url: {
        enable: true,
        config: {
          limit: 1024
        }
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  }
}

export default defineConfig<'vite'>(async (merge, { mode }) => {
  return merge({}, config, mode === 'development' ? devConfig : prodConfig)
})
