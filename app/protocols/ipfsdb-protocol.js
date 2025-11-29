export default async function makeIPFSDBFetch (opts = {}) {
  const errLog = opts.err
  const repo = opts.repo
  const fse = await import('fs-extra')
  const { createOrbitDB } = await import('@orbitdb/core')
  const {CID} = await import('multiformats')
  const {base58btc} = (await import('multiformats/basics')).bases
  const crypto = await import('crypto')
  const orbitdb = await createOrbitDB({ id: opts.orbitid || 'test', ipfs: opts.helia })
  // const {text2arr} = await import('uint8-util')
    const { Readable } = await import('streamx')
    const mainHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Allow-CSP-From': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Request-Headers': '*'
    }
    const addrs = new Map()

    if(!await fse.pathExists(repo)){
      await fse.ensureDir(repo)
    }
  
    function formatReq(hostname, pathname){
      pathname = decodeURIComponent(pathname)
      const lastSlash = pathname.slice(pathname.lastIndexOf('/'))
      return {useHost: hostname, usePath: pathname, ext: lastSlash, fullPath: pathname}
    }

    async function streamToString(stream) {
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString('utf8')
    }

    async function startTitle(title){
      let titleToUse
      try {
        titleToUse = CID.parse(title).toString(base58btc.encoder)
      } catch {
        titleToUse = title
      }
      const useTitle = /^[A-HJ-NP-Za-km-z1-9]*$/.test(titleToUse) ? `/orbitdb/${titleToUse}` : titleToUse
      const test = await orbitdb.open(useTitle, {type: 'documents'})
      const str = test.address.split('/').filter(Boolean)[1]
      const useStr = CID.parse(str, base58btc.decoder).toV1().toString()
      test.strForAddress = useStr
      addrs.set(test.strForAddress, test)
      return test
    }

    async function stopTitle(title, conn){
      await conn.close()
      addrs.delete(title)
    }

    async function makeIpfsDb(session){
      try {
      // const session = new Request(url, opt)
      const mainURL = new URL(session.url)
      const searchParams = mainURL.searchParams
      const reqHeaders = new Headers(session.headers)
      const body = session.body
      const method = session.method
      const { mimeType: type, ext, query, fullPath, isCID, useHost, usePath: usedPath } = formatReq(decodeURIComponent(mainURL.hostname), decodeURIComponent(mainURL.pathname))

      if(method === 'GET'){
        const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
        const odb = addrs.has(useHost) ? addrs.get(useHost) : await startTitle(useHost)
        const usePath = fullPath.slice(1)
        if(usePath){
          const useData = await odb.get(usePath)
          return new Response(JSON.stringify(useData.value), {status: 200, headers: {...mainHeaders, 'X-Address': odb.strForAddress, 'Content-Type': 'application/json; charset=UTF-8'}})
        } else {
          const arr = []
          for await (const record of odb.iter(useOpt)){
            const {hash, payload} = record
            arr.push({hash, payload})
          }
          // console.log(arr)
          return new Response(JSON.stringify(arr), {status: 200, headers: {...mainHeaders, 'X-Address': odb.strForAddress, 'Content-Type': 'application/json; charset=UTF-8'}})
        }
      } else if(method === 'POST'){
        const odb = addrs.has(useHost) ? addrs.get(useHost) : await startTitle(useHost)
        const usePath = fullPath.slice(1)
        const getSaved = reqHeaders.has('content-type') ? reqHeaders.get('content-type').includes('multipart/form-data') ? Object.fromEntries((await session.formData()).entries()) : JSON.parse(await streamToString(body)) : JSON.parse(await streamToString(body))
        const stamp = Date.now()
        getSaved._id = usePath || getSaved._id || stamp + '-' + crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex')
        getSaved.stamp = getSaved.stamp || stamp
        const hash = await odb.put(getSaved)
        return new Response(JSON.stringify(getSaved._id), {status: 200, headers: {...mainHeaders, 'X-Hash': hash, 'X-Address': odb.strForAddress, 'Content-Type': 'application/json; charset=UTF-8'}})
      } else if(method === 'DELETE'){
        const odb = addrs.has(useHost) ? addrs.get(useHost) : await startTitle(useHost)
        const strToUse = odb.strForAddress
        const usePath = fullPath.slice(1)
        if(usePath){
          await odb.del(usePath)
        } else {
          await stopTitle(strToUse, odb)
        }
        return new Response(JSON.stringify(usePath || useHost), { status: 200, headers: { ...mainHeaders, 'X-Address': strToUse, 'Content-Type': 'application/json; charset=UTF-8' } })
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
      return await orbitdb.stop()
    }

    function intoStream (data) {
      return new Readable({
        read () {
          this.push(data)
          this.push(null)
        }
      })
    }

    return {handler: makeIpfsDb, close}
  }