import path from 'path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import mime from 'mime'
import ScopedFS from 'scoped-fs'

import { version, dependencies as packageDependencies } from '../version.js'
import Config from '../config.js'
const { theme } = Config

const CHECK_PATHS = [
  (path) => path,
  (path) => path + '.html',
  (path) => path + '.md'
]

const pagesURL = new URL('../pages', import.meta.url)
const pagesPath = fileURLToPath(pagesURL)

const fs = new ScopedFS(pagesPath)

export default async function createHandler () {

  return async function protocolHandler (req) {

    const { url, headers: reqHeaders } = req

    const parsed = new URL(url)
    const { pathname, hostname, searchParams } = parsed
    const toResolve = path.join(hostname, pathname)
    if (hostname === 'info') {
      const statusCode = 200

      const packagesToRender = [
        'log-fetch',
        'chunk-fetch',
        'list-fetch',
        'onion-fetch'
      ]

      const dependencies = {}
      for (const name of packagesToRender) {
        dependencies[name] = packageDependencies[name]
      }

      const aboutInfo = {
        version,
        dependencies
      }

      const data = intoStream(JSON.stringify(aboutInfo, null, '\t'))

      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Allow-CSP-From': '*',
        'Content-Type': 'application/json'
      }

      return new Response(data, {status: statusCode, headers})
      // return
    } else if ((hostname === 'theme') && (pathname === '/vars.css')) {
      const statusCode = 200

      const themes = Object
        .keys(theme)
        .map((name) => `  --hy-theme-${name}: ${theme[name]};`)
        .join('\n')

      const data = intoStream(`
:root {
  --hy-color-blue: #0000FF;
  --hy-color-black: #000000;
  --hy-color-white: #FFFFFF;
  --hy-color-red: #FF0000;
}

:root {
${themes}
}
      `)

      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Allow-CSP-From': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/css'
      }

      return new Response(data, {status: statusCode, headers})
      // return
    }

    try {
      const resolvedPath = await resolveFile(toResolve)
      const statusCode = 200

      const contentType = mime.getType(resolvedPath) || 'text/plain'

      const data = fs.createReadStream(resolvedPath)

      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Allow-CSP-From': 'hybrid://welcome',
        'Cache-Control': 'no-cache',
        'Content-Type': contentType
      }

      return new Response(data, {status: statusCode, headers})
      // return
    } catch (e) {
      const statusCode = 400

      const data = fs.createReadStream('error.html')

      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Allow-CSP-From': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/html'
      }

      return new Response(data, {status: statusCode, headers})
      // return
    }
  }
}

async function resolveFile(path) {
  for (const toTry of CHECK_PATHS) {
    const tryPath = toTry(path)
    if (await exists(tryPath)) {
      return tryPath
    }
  }
  throw new Error('Not Found')
}

function exists (path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stat) => {
      if (err) {
        if (err.code === 'ENOENT') resolve(false)
        else reject(err)
      } else resolve(stat.isFile())
    })
  })
}

function intoStream (data) {
  return new Readable({
    read () {
      this.push(data)
      this.push(null)
    }
  })
}

// function useHead(head){
//   const test = {}
//   for(const pair of head.entries()){
//     test[pair[0]] = pair[1]
//   }
//   return test
// }