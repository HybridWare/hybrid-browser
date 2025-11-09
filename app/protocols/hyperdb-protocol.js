export default async function makeHYPERDBFetch (opts = {}) {
    const errLog = opts.err
    const storage = opts.storage
    const {default: Hyperbee} = await import('hyperbee')
    const { Readable, pipelinePromise } = await import('streamx')
    const fse = await import('fs-extra')
    const crypto = await import('crypto')
    const hostType = '_'
    const mainHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Allow-CSP-From': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Request-Headers': '*'
    }
    const addrs = new Map()

    // async function checkPath(data){
    //   try {
    //     await fs.access(data)
    //     return true
    //   } catch {
    //     return false
    //   }
    // }

    if(!await fse.pathExists(storage)){
      await fse.ensureDir(storage)
    }

    const sdk = opts.sdk

    async function startTitle(title){
      const core = await sdk.get(title)
      const db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
      await db.ready()
      const str = db.key.toString('hex')
      sdk.join(str, {})
      addrs.set(str, db)
      return db
    }

    async function stopTitle(title, conn){
      await conn.close()
      addrs.delete(title)
    }

    async function streamToString(stream) {
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString('utf8')
    }
  
    function formatReq(hostname, pathname){
      const useData = {useHost: hostname, usePath: decodeURIComponent(pathname)}
      return useData
    }

    async function makeHyperDb(session){
      try {
      // const session = new Request(url, opt)
      const mainURL = new URL(session.url)
      const reqHeaders = new Headers(session.headers)
      const searchParams = mainURL.searchParams
      const body = session.body
      const method = session.method
      const main = formatReq(decodeURIComponent(mainURL.hostname), decodeURIComponent(mainURL.pathname))

      if(method === 'GET'){
          const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
          const test = main.useHost === hostType ? reqHeaders.get('x-address') || searchParams.get('x-address') : main.useHost
          const db = addrs.has(test) ? addrs.get(test) : await startTitle(test)
          const fullPath = main.usePath.slice(1)

          if(fullPath){
            const doc = await db.get(fullPath)
            return new Response(JSON.stringify(doc.value), {status: 200, headers: {...mainHeaders, 'Content-Type': 'application/json; charset=UTF-8'}})
          } else {
            const arr = []
            for await (const record of db.createReadStream(useOpt)){
              arr.push(record.value)
            }
            return new Response(JSON.stringify(arr), {status: 200, headers: {...mainHeaders, 'Content-Type': 'application/json; charset=UTF-8'}})
          }
      } else if(method === 'POST'){
        const test = main.useHost === hostType ? reqHeaders.get('x-address') || searchParams.get('x-address') : main.useHost
          const db = addrs.has(test) ? addrs.get(test) : await startTitle(test)
          const fullPath = main.usePath.slice(1)
          const getSaved = reqHeaders.has('content-type') ? reqHeaders.get('content-type').includes('multipart/form-data') ? Object.fromEntries((await session.formData()).entries()) : JSON.parse(await streamToString(body)) : JSON.parse(await streamToString(body))
          const stamp = Date.now()
          getSaved._id = fullPath || getSaved._id || stamp + '-' + crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex')
          getSaved.stamp = getSaved.stamp || stamp
          const prop = getSaved._id
          await db.put(prop, getSaved)
          return new Response(JSON.stringify(prop), {status: 200, headers: {...mainHeaders, 'X-Address': db.key.toString('hex'), 'Content-Type': 'application/json; charset=UTF-8'}})
      } else if(method === 'DELETE'){
        const test = main.useHost === hostType ? reqHeaders.get('x-address') || searchParams.get('x-address') : main.useHost
          const db = addrs.has(test) ? addrs.get(test) : await startTitle(test)
          const fullPath = main.usePath.slice(1)
          if(fullPath){
            await db.del(fullPath)
          } else {
            await stopTitle(test, db)
          }
          return new Response(JSON.stringify(fullPath || test), { status: 200, headers: { ...mainHeaders, 'Content-Type': 'application/json; charset=UTF-8' } })
      } else {
        return new Response('invalid method', {status: 400, headers: mainHeaders})
      }
      } catch (error) {
        if(errLog){
          console.error(error)
        }
        return new Response(intoStream(error.stack), {status: 500, headers: mainHeaders})
      }
    }
  
    async function close(){
      for(const i of addrs.values()){
        // await i.purge()
        await i.close()
      }
      // return await sdk.close()
      return
    }

    function intoStream (data) {
      return new Readable({
        read () {
          this.push(data)
          this.push(null)
        }
      })
    }

    return {handler: makeHyperDb, close}
  }