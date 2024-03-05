export default async function makeIPFSFetch (opts = {}) {
    const { CID } = await import('multiformats/cid')
    const {default: parseRange} = await import('range-parser')
    const {default: mime} = await import('mime')
    const { Readable } = await import('streamx')
    const path = await import('path')
    const fs = await import('fs/promises')
    // const fse = await import('fs-extra')
    const DEFAULT_OPTS = {timeout: 30000}
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    const serve = finalOpts.serve
    const block = finalOpts.block
    const hostType = '.'
    const repo = finalOpts.repo
    const ipfsTimeout = finalOpts.timeout
    const mainHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Allow-CSP-From': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Request-Headers': '*'
    }

    async function pathExists(arg){
      try {
        await fs.access(arg)
        return true
      } catch (error) {
        console.error(error)
        return false
      }
    }
    
    const app = await (async () => { if (finalOpts.helia) { return finalOpts.helia; } else {const {createHelia} = await import('helia');const {FsDatastore} = await import('datastore-fs');const {FsBlockstore} = await import('blockstore-fs');return await createHelia({blockstore: new FsBlockstore(repo), datastore: new FsDatastore(repo)});} })()
    const fileSystem = await (async () => {const {unixfs} = await import('@helia/unixfs');return unixfs(app);})()
    if(!await pathExists(path.join(repo, 'block.txt'))){
      await fs.writeFile(path.join(repo, 'block.txt'), JSON.stringify([]))
    }
    const blockList = block ? JSON.parse((await fs.readFile(path.join(repo, 'block.txt'))).toString('utf-8')) : null
  
    function formatReq(hostname, pathname){
      pathname = decodeURIComponent(pathname)
      const lastSlash = pathname.slice(pathname.lastIndexOf('/'))
      return {mimeType: mime.getType(lastSlash), query: hostname === hostType, useHost: hostname, usePath: pathname, ext: lastSlash, fullPath: pathname}
    }

    function handleFormData(formdata) {
        const arr = []
        for (const info of formdata.values()) {
          if (info.stream) {
            arr.push(info)
          }
        }
        return arr
    }
  
    // function genDir(id, hash, data) {
    //   if (id) {
    //     const test = path.join(`/${hash}`, data).replace(/\\/g, "/")
    //     return test.endsWith('/') ? test.slice(0, test.lastIndexOf('/')) : test
    //   } else {
    //     return data
    //   }
    // }
  
    async function dirIter (iterable) {
      const result = []
      for await (const item of iterable) {
        item.cid = item.cid.toV1().toString()
        item.link = item.type === 'file' ? 'ipfs://' + path.join(item.cid, item.name).replace(/\\/g, "/") : 'ipfs://' + path.join(item.cid, '/').replace(/\\/g, "/")
        result.push(item)
      }
      return result
    }
  
    async function saveFormData(useQuery, useHost, usePath, data, useOpts) {
      const useHostPath = useQuery ? usePath : path.join('/', useHost, usePath).replace(/\\/g, '/')
      let test
      const src = data.map((datas) => {return {path: path.join(useHostPath, datas.webkitRelativePath || datas.name), content: Readable.from(datas.stream())}})
      for await (const testing of fileSystem.addAll(src, useOpts)){
        test = testing.cid
      }
      return src.map((datas) => {return 'ipfs://' + test.toString() + datas.path})
    }
  
    async function saveFileData(useQuery, useHost, usePath, data, useOpts) {
      const useHostPath = useQuery ? usePath : path.join('/', useHost, usePath).replace(/\\/g, '/')
      const src = [{path: useHostPath, content: Readable.from(data)}]
      let test
      for await (const testing of fileSystem.addAll(src, useOpts)){
        test = testing.cid
      }
      return 'ipfs://' + test.toString() + useHostPath
    }

    // async function dataFromCat(cids, opts){
    //   let test = ''
    //   for await (const tests of fileSystem.cat(cids,opts)){
    //     test = test + tests.toString()
    //   }
    //   return test
    // }

    async function waitForStuff(useTo, mainData) {
      if (useTo.num) {
        return await Promise.race([
          new Promise((resolve, reject) => setTimeout(() => { const err = new Error(`${useTo.msg} timed out`); err.name = 'TimeoutError'; reject(err); }, useTo.num)),
          mainData
        ])
      } else {
        return await mainData
      }
    }

    async function makeIpfs(session){
      try {
      // const session = new Request(url, opt)
      const mainURL = new URL(session.url)
      const reqHeaders = session.headers
      const searchParams = mainURL.searchParams
      const body = session.body
      const method = session.method
      const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : 0 : ipfsTimeout
      const { mimeType: type, ext, query, fullPath, isCID, useHost, usePath } = formatReq(decodeURIComponent(mainURL.hostname), decodeURIComponent(mainURL.pathname))
      const isItBlock = block && !query && blockList.includes(useHost)

      if(method === 'HEAD'){
          const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
          const useOpts = { ...useOpt, timeout: mainTimeout }
      
          if(reqHeaders.has('x-block') || searchParams.has('x-block')){
            if(JSON.parse(reqHeaders.get('x-block') || searchParams.get('x-block'))){
              if(blockList.includes(useHost)){
                return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'already blocked'}})
              } else {
                const mainCid = CID.parse(useHost)
                if(serve && await app.pins.isPinned(mainCid, {})){
                  await app.pins.rm(mainCid, {})
                }
                const useCid = await fileSystem.rm(mainCid, usePath, { ...useOpt, cidVersion: 1, recursive: true })
                // await app.files.rm(query, { ...useOpt, cidVersion: 1, recursive: true })
                const useLink = `ipfs://${useCid}/`

                blockList.push(useHost)
                await fs.writeFile(path.join(repo, 'block.txt'), JSON.stringify(blockList))

                return new Response(null, { status: 200, headers: {...mainHeaders, 'X-Status': 'now blocking', 'X-Link': useLink}})
              }
            } else {
              if(!blockList.includes(useHost)){
                return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'already unblocked'}})
              } else {
                blockList.splice(blockList.indexOf(useHost), 1)
                await fs.writeFile(path.join(repo, 'block.txt'), JSON.stringify(blockList))
                return new Response(null, { status: 200, headers: {...mainHeaders, 'X-Status': 'now unblocking'}})
              }
            }
          } else if (reqHeaders.has('x-copy') || searchParams.has('x-copy')) {
            if(isItBlock){
              return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
            }
            const checkID = CID.parse(useHost)
            const checkPath = usePath === '/' ? undefined : usePath
            const checkStat = await fileSystem.stat(checkID, {path: checkPath})
            if(checkStat.type === 'directory'){
              let useCID = await fileSystem.addDirectory()
              for await (const test of fileSystem.ls(checkID, {path: checkPath})){
                useCID = await fileSystem.cp(test.cid, useCID, test.name)
              }
              const useLink = `ipfs://${path.join(useCID.toV1().toString(), '/').replace(/\\/g, "/")}`
              const useHeaders = { 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` }
              if (type) {
                useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
              }
              return new Response(null, { status: 200, headers: {...mainHeaders, ...useHeaders}})
            } else {
              const useCID = await fileSystem.addFile({path: usePath, content: Readable.from(fileSystem.cat(checkID, {path: usePath}))}, {wrapWithDirectory: true})
              const useLink = `ipfs://${path.join(useCID.toV1().toString(), usePath).replace(/\\/g, "/")}`
              const useHeaders = { 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` }
              if (type) {
                useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
              }
              return new Response(null, { status: 200, headers: {...mainHeaders, ...useHeaders}})
            }
          } else if (reqHeaders.has('x-pin') || searchParams.has('x-pin')) {
            if(isItBlock){
              return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
            }
            const usePin = JSON.parse(reqHeaders.get('x-pin') || searchParams.get('x-pin')) ? await waitForStuff({num: useOpts.timeout, msg: 'add pin'}, app.pins.add(CID.parse(useHost), useOpts)) : await waitForStuff({num: useOpts.timeout, msg: 'add pin'}, app.pins.rm(CID.parse(useHost), useOpts))
            const useLink = `ipfs://${path.join(usePin.cid.toV1().toString(), usePath).replace(/\\/g, "/")}`
            const useHeaders = { 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` }
            if (type) {
              useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
            }
            return new Response(null, { status: 200, headers: {...mainHeaders, ...useHeaders}})
          }  else {
            if(isItBlock){
              return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
            }
            useOpts.path = usePath === '/' ? undefined : usePath
            const mainData = await waitForStuff({num: useOpts.timeout, msg: 'add pin'}, fileSystem.stat(CID.parse(useHost), useOpts))
            const useLink = `ipfs://${path.join(useHost, usePath).replace(/\\/g, "/")}`
            const useHeaders = {'X-Canon': mainData.cid.toV1().toString(), 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${mainData.size}` }
            if (type) {
              useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
            }
            return new Response(null, { status: 200, headers: {...mainHeaders, ...useHeaders} })
          }
      } else if(method === 'GET'){
        if(isItBlock){
          return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
        }
          const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
          const useOpts = { ...useOpt, timeout: mainTimeout }
      
          const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
          const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'

          useOpts.path = usePath === '/' ? undefined : usePath
          const useCID = CID.parse(useHost)
          const mainData = await waitForStuff({num: useOpts.timeout, msg: 'get cid'}, fileSystem.stat(useCID, useOpts))
          const mainCid = mainData.cid.toV1().toString()

          if(mainData.type === 'directory'){
            const plain = await dirIter(fileSystem.ls(mainData.cid, useOpts))
            const useLink = `ipfs://${path.join(useHost, usePath).replace(/\\/g, "/")}`
            return new Response(mainReq ? `<html><head><title>${useHost}</title></head><body><div>${plain.map((data) => {return `<p><a href="${data.link}">${data.name}</a></p>`})}</div></body></html>` : JSON.stringify(plain), {status: 200, headers: {...mainHeaders, 'X-Canon': mainCid, 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${mainData.size}`}})
          } else {
            if(serve && !await app.pins.isPinned(mainData.cid, {})){
              await app.pins.add(mainData.cid, {})
            }
            const useLink = `ipfs://${path.join(useHost, usePath).replace(/\\/g, "/")}`
            const isRanged = reqHeaders.has('Range') || reqHeaders.has('range')
            if (isRanged) {
              const ranges = parseRange(Number(mainData.fileSize), reqHeaders.get('Range') || reqHeaders.get('range'))
              if (ranges && ranges.length && ranges.type === 'bytes') {
                const [{ start, end }] = ranges
                const length = (end - start + 1)
                const useHeaders = {'X-Canon': mainCid, 'X-Link': `${useLink}`, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${length}`, 'Content-Range': `bytes ${start}-${end}/${mainData.size}`}
                if(type){
                  useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
                }
                return new Response(fileSystem.cat(useCID, { ...useOpts, offset: start, length }), {status: 206, headers: {...mainHeaders, ...useHeaders}})
              } else {
                return new Response(mainReq ? '<html><head><title>range</title></head><body><div><p>malformed or unsatisfiable range</p></div></body></html>' : JSON.stringify('malformed or unsatisfiable range'), {status: 416, headers: {...mainHeaders, 'X-Link': `${useLink}`, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Type': mainRes, 'Content-Length': `${mainData.size}`}})
              }
            } else {
              const useHeaders = {'X-Canon': mainCid, 'X-Link': `${useLink}`, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${mainData.size}`}
              if(type){
                useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
              }
              return new Response(fileSystem.cat(mainData.cid, useOpts), {status: 200, headers: {...mainHeaders, ...useHeaders}})
            }
          }
      } else if(method === 'POST'){
            const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
            const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
      
          try {
            const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
            const getSaved = reqHeaders.has('content-type') && reqHeaders.get('content-type').includes('multipart/form-data') ? await saveFormData(query, useHost, usePath, handleFormData(await session.formData()), { ...useOpt, cidVersion: 1, rawLeaves: false, wrapWithDirectory: true }) : await saveFileData(query, useHost, usePath, body, { ...useOpt, cidVersion: 1, rawLeaves: false, wrapWithDirectory: true })
            const useLink = `ipfs://${useHost}${usePath}`
            return new Response(mainReq ? `<html><head><title>${useHost}</title></head><body><div>${Array.isArray(getSaved) ? JSON.stringify(getSaved) : getSaved}</div></body></html>` : JSON.stringify(getSaved), {status: 200, headers: {...mainHeaders, 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`}})
          } catch (error) {
            throw error
          }
      } else if(method === 'DELETE'){
          const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
          const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
      
          try {
          const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
          const mainCid = CID.parse(useHost)
          if(serve && await app.pins.isPinned(mainCid, {})){
            await app.pins.rm(mainCid, {})
          }
          const useCid = await fileSystem.rm(mainCid, usePath.slice(1), { ...useOpt, cidVersion: 1, recursive: true })
          // await app.files.rm(query, { ...useOpt, cidVersion: 1, recursive: true })
          const usedLink = `ipfs://${useHost}${usePath}`
          const usingLink = `ipfs://${useCid.toV1().toString()}/`
          return new Response(mainReq ? `<html><head><title>${useHost}</title></head><body><div>${JSON.stringify(usingLink)}</div></body></html>` : JSON.stringify(usingLink), { status: 200, headers: { ...mainHeaders, 'Content-Type': mainRes, 'X-Link': usedLink, 'Link': `<${usedLink}>; rel="canonical"` } })
          } catch (error) {
            throw error
          }
      } else {
        return new Response('invalid method', {status: 400, headers: mainHeaders})
      }
      } catch (error) {
        console.error(error)
        return new Response(intoStream(error.stack), {status: 500, headers: mainHeaders})
      }
    }
  
    async function close(){return await app.stop()}

    function intoStream (data) {
      return new Readable({
        read () {
          this.push(data)
          this.push(null)
        }
      })
    }

    return {handler: makeIpfs, close}
  }