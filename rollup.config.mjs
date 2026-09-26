import copy from "rollup-plugin-copy"
import gzipPlugin from "rollup-plugin-gzip"
import terser from "@rollup/plugin-terser"

import { brotliCompress } from "zlib"
import { promisify } from "util"

const brotliPromise = promisify(brotliCompress)

export default [
  {
    input: "./src/index.js",
    output: [
      {
        file: "./dist/resizable-panels-zero.esm.js",
        format: "esm",
        sourcemap: true
      },
      {
        file: "./dist/resizable-panels-zero.min.js",
        format: "esm",
        plugins: [ terser() ]
      }
    ],
    plugins: [
      copy({
        targets: [
          { src: "styles/*.css", dest: "dist" }
        ]
      }),
      gzipPlugin({
        gzipOptions: { level: 9 }
      }),
      gzipPlugin({
        customCompression: content => brotliPromise(Buffer.from(content)),
        fileName: ".br"
      })
    ]
  }
]
