export default async function makeBTFetch (opts = {}) {
  const errLog = opts.err
    const {default: mime} = await import('mime')
    const {default: parseRange} = await import('range-parser')
    const path = await import('path')
    const fs = await import('fs/promises')
    const {Readable} = await import('stream')
    const fse = await import('fs-extra')
    const DEFAULT_OPTS = {timeout: 30000}
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    // const checkHash = /^[a-fA-F0-9]{40}$/
    // const checkAddress = /^[a-fA-F0-9]{64}$/
    const hostTypeKey = '_'
    const hostTypeHash = '.'
    const btTimeout = finalOpts.timeout
    const block = finalOpts.block
    const dir = finalOpts.dir
    const mainHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Allow-CSP-From': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Request-Headers': '*'
    }

    // async function checkPath(data){
    //   try {
    //     await fs.access(data)
    //     return true
    //   } catch {
    //     return false
    //   }
    // }

    if(!await fse.pathExists(dir)){
      await fse.ensureDir(dir)
    }
  
    const app = await (async () => {if(finalOpts.torrentz){return finalOpts.torrentz}else{const Torrentz = await import('torrentz');return new Torrentz(finalOpts);}})()
    function handleErr(err){
      console.error(err)
    }
    app.on('err', handleErr)
    if(!await fse.pathExists(path.join(dir, 'block.txt'))){
      await fs.writeFile(path.join(dir, 'block.txt'), JSON.stringify([]))
    }
    const blockList = block ? JSON.parse((await fs.readFile(path.join(dir, 'block.txt'))).toString('utf-8')) : null
  
    function handleFormData(formdata) {
      const arr = []
      for (const info of formdata.values()) {
        if (info.stream) {
          arr.push(info)
        }
      }
      return arr
    }
  
    // function htmlIden(data){
    //   if(data.address){
    //     data.link = `<a href='bt://${data.address}/'>${data.address}</a>`
    //   } else if(data.infohash){
    //     data.link = `<a href='bt://${data.infohash}/'>${data.infohash}</a>`
    //   }
    //   return `<p>${JSON.stringify(data)}</p>`
    // }
  
    // function jsonIden(data){
    //   if(data.address){
    //     data.link = `bt://${data.address}/`
    //   } else if(data.infohash){
    //     data.link = `bt://${data.infohash}/`
    //   }
    //   return data
    // }
  
    function getMimeType (path) {
      let mimeType = mime.getType(path) || 'text/plain'
      if (mimeType.startsWith('text/')) mimeType = `${mimeType}; charset=utf-8`
      return mimeType
    }

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
  
    function formatReq (hostname, pathname, ext) {
  
      // let mainType = hostname[0] === hostType || hostname[0] === sideType ? hostname[0] : ''
      const keyType = hostname === hostTypeKey
      const hashType = hostname === hostTypeHash
      const mainQuery = keyType || hashType
      let id
      let extra

      const mainHost = hostname
      let mainType
      
      if(mainQuery){
        if(keyType){
          mainType = true
        } else if(hashType){
          mainType = false
        } else {
          throw new Error('host type is invalid')
        }
      } else {
        id = mainHost
        extra = ext
      }
      
      const mainPath = decodeURIComponent(pathname)
      const mainLink = `bt://${mainHost}${mainPath.includes('.') ? mainPath : mainPath + '/'}`
      return { mainQuery, mainType, mainHost, mainPath, mainLink, id, extra }
    }

    async function makeBt(session){
      // const session = new Request(url, opt)
      try {
        const mainURL = new URL(session.url)
        const reqHeaders = new Headers(session.headers)
        const searchParams = mainURL.searchParams
        const body = session.body
        const method = session.method
        const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : 0 : btTimeout
        const mid = formatReq(decodeURIComponent(mainURL.hostname), decodeURIComponent(mainURL.pathname), reqHeaders.get('x-authentication'))
        const isItBlock = block && !mid.mainQuery && blockList.includes(mid.id)

        if(method === 'HEAD'){
          const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
          const useOpts = { ...useOpt, timeout: reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : undefined : btTimeout }
          
          if(reqHeaders.has('x-block') || searchParams.has('x-block')){
            if(JSON.parse(reqHeaders.get('x-block') || searchParams.get('x-block'))){
              if(blockList.includes(mid.id)){
                return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'already blocked'}})
              } else {
                const torrentData = await app.shredTorrent(mid.id, '/', {})
                const useIden = torrentData.address || torrentData.infohash || torrentData.msg || torrentData.id
                const useLink = `bt://${useIden}/`

                blockList.push(mid.id)
                await fs.writeFile(path.join(dir, 'block.txt'), JSON.stringify(blockList))

                return new Response(null, { status: 200, headers: {...mainHeaders, 'X-Status': 'now blocking', 'X-Link': useLink}})
              }
            } else {
              if(!blockList.includes(mid.id)){
                return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'already unblocked'}})
              } else {
                blockList.splice(blockList.indexOf(mid.id), 1)
                await fs.writeFile(path.join(dir, 'block.txt'), JSON.stringify(blockList))
                return new Response(null, { status: 200, headers: {...mainHeaders, 'X-Status': 'now unblocking'}})
              }
            }
          } else {
            if(isItBlock){
              return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
            }
            const useData = await waitForStuff({num: mainTimeout, msg: 'timed out'}, app.loadTorrent(mid.id, mid.mainPath, useOpts))
            if(useData){
              if(useData.createReadStream){
                const useHeaders = {}
                useHeaders['Content-Type'] = getMimeType(useData.path)
                useHeaders['Content-Length'] = `${useData.length}`
                useHeaders['Accept-Ranges'] = 'bytes'
                useHeaders['X-Downloaded'] = `${useData.downloaded}`
                useHeaders['X-Link'] = `bt://${mid.mainHost}${mid.mainPath}`
                useHeaders['Link'] = `<bt://${useHeaders['X-Link']}>; rel="canonical"`
    
                return new Response(null, {status: 200, headers: {...mainHeaders, ...useHeaders}})
              } else if (useData.forEach) {
                const useHeaders = { 'Content-Length': 0, 'X-Downloaded': 0, 'X-Link': `bt://${mid.mainHost}${mid.mainPath}` }
                useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
                useData.forEach((data) => {
                  useHeaders['Content-Length'] = useHeaders['Content-Length'] + data.length
                  useHeaders['X-Downloaded'] = useHeaders['X-Downloaded'] + data.downloaded
                })
                
                return new Response(null, { status: 200, headers: {...mainHeaders, ...useHeaders}})
              } else {
                return new Response(null, { status: 400, headers: { ...mainHeaders, 'X-Error': 'did not find any data' }})
              }
            } else {
              return new Response(null, { status: 400, headers: { ...mainHeaders, 'X-Error': 'did not find any data' }})
            }
          }
        } else if(method === 'GET'){
          if(isItBlock){
            return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
          }
            const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
            const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
        
            const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
            const useOpts = { ...useOpt, timeout: reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : undefined : btTimeout }
            const useData = await waitForStuff({num: mainTimeout, msg: 'timed out'}, app.loadTorrent(mid.id, mid.mainPath, useOpts))
            if(useData){
              if(useData.createReadStream){
                const mainRange = reqHeaders.has('Range') || reqHeaders.has('range')
                if (mainRange) {
                  const ranges = parseRange(useData.length, reqHeaders.get('Range') || reqHeaders.get('range'))
                  if (ranges && ranges.length && ranges.type === 'bytes') {
                    const [{ start, end }] = ranges
                    const length = (end - start + 1)
      
                    return new Response(useData.createReadStream({ start, end }), {status: 206, headers: {...mainHeaders,'X-Link': `bt://${mid.mainHost}${mid.mainPath}`, 'Link': `<bt://${mid.mainHost}${mid.mainPath}>; rel="canonical"`, 'Content-Length': `${length}`, 'Content-Range': `bytes ${start}-${end}/${useData.length}`, 'Content-Type': getMimeType(useData.path)}})
                  } else {
                    return new Response(mainReq ? '<html><head><title>range</title></head><body><div><p>malformed or unsatisfiable range</p></div></body></html>' : JSON.stringify('malformed or unsatisfiable range'), {status: 416, headers: {...mainHeaders, 'Content-Type': mainRes, 'Content-Length': String(useData.length)}})
                  }
                } else {
                  return new Response(useData.createReadStream(), {status: 200, headers: {...mainHeaders,'Content-Type': getMimeType(useData.path), 'X-Link': `bt://${mid.mainHost}${mid.mainPath}`, 'Link': `<bt://${mid.mainHost}${mid.mainPath}>; rel="canonical"`, 'Content-Length': String(useData.length)}})
                }
              } else if (useData.forEach) {
                const useHeaders = { 'Content-Length': 0, 'Accept-Ranges': 'bytes', 'X-Downloaded': 0, 'X-Link': `bt://${mid.mainHost}${mid.mainPath}` }
                useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
                useData.forEach((data) => {
                  useHeaders['Content-Length'] = useHeaders['Content-Length'] + data.length
                  useHeaders['X-Downloaded'] = useHeaders['X-Downloaded'] + data.downloaded
                })
                useHeaders['Content-Type'] = mainRes
                useHeaders['Content-Length'] = String(useHeaders['Content-Length'])
                useHeaders['X-Downloaded'] = String(useHeaders['X-Downloaded'])
                return new Response(mainReq ? `<html><head><title>${mid.mainLink}</title></head><body><div><h1>Directory</h1><p><a href='../'>..</a></p>${useData.length ? useData.map(file => { return `<p><a href='${file.urlPath}'>${file.name}</a></p>` }) : `<p>directory is empy, it is either still downloading, or this directory is supposed to be empty</p>`}</div></body></html>` : JSON.stringify(useData.map(file => { return file.urlPath })), {status: 200, headers: {...mainHeaders, ...useHeaders}})
              } else {
                return new Response(mainReq ? `<html><head><title>${mid.mainLink}</title></head><body><div><p>could not find the data</p></div></body></html>` : JSON.stringify('could not find the data'), { status: 400, headers: { ...mainHeaders, 'Content-Type': mainRes } })
              }
            } else {
              return new Response(mainReq ? `<html><head><title>${mid.mainLink}</title></head><body><div><p>Error: could not find the data</p></div></body></html>` : JSON.stringify({error: 'could not find the data'}), { status: 400, headers: { ...mainHeaders, 'Content-Type': mainRes, 'X-Error': 'could not find the data' } })
            }
        } else if(method === 'POST'){
            const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
            const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
        
            if (mid.mainQuery) {
              if (mid.mainType) {
                mid.id = true
                mid.extra = null
              } else {
                mid.id = false
              }
            }
        
              const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
              const useOpts = {
                  ...useOpt,
                  seq: reqHeaders.has('x-version') || searchParams.has('x-version') ? Number(reqHeaders.get('x-version') || searchParams.get('x-version')) : null,
                  extra: mid.extra
                }
              const useBody = reqHeaders.has('content-type') && reqHeaders.get('content-type').includes('multipart/form-data') ? handleFormData(await session.formData()) : body
              const torrentData = await app.publishTorrent(mid.id, mid.mainPath, useBody, useOpts)
              const useHeaders = {}
              for (const test of ['sequence', 'name', 'infohash', 'dir', 'seed', 'secret', 'address']) {
                if (torrentData[test] || typeof(torrentData[test]) === 'number') {
                  useHeaders['X-' + test.charAt(0).toUpperCase() + test.slice(1)] = torrentData[test]
                }
              }
              const useIden = torrentData.address || torrentData.infohash || torrentData.msg || torrentData.id
              useHeaders['X-Link'] = `bt://${useIden}${torrentData.path}`
              useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
              return new Response(mainReq ? `<html><head><title>${useIden}</title></head><body><div>${Array.isArray(torrentData.saved) ? JSON.stringify(torrentData.saved.map((data) => {return 'bt://' + path.join(useIden, data).replace(/\\/g, '/')})) : 'bt://' + path.join(useIden, torrentData.saved).replace(/\\/g, '/')}</div></body></html>` : JSON.stringify(Array.isArray(torrentData.saved) ? torrentData.saved.map((data) => {return 'bt://' + path.join(useIden, data).replace(/\\/g, '/')}) : 'bt://' + path.join(useIden, torrentData.saved).replace(/\\/g, '/')), { status: 200, headers: { ...mainHeaders, 'Content-Length': String(torrentData.length), 'Content-Type': mainRes, ...useHeaders } })
        } else if(method === 'DELETE'){
            const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
            const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
        
            if (mid.mainQuery) {
              return new Response(mainReq ? `<html><head><title>${mid.mainLink}</title></head><body><div><p>invalid query</p></div></body></html>` : JSON.stringify('invalid query'), { status: 400, headers: {...mainHeaders, 'Content-Type': mainRes} })
            }
              const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
              const useOpts = {
                  ...useOpt,
                  count: reqHeaders.has('x-version') || searchParams.has('x-version') ? Number(reqHeaders.get('x-version') || searchParams.get('x-version')) : null
              }
              const torrentData = await app.shredTorrent(mid.id, mid.mainPath, useOpts)
              const useHead = {}
              for (const test of ['id', 'path', 'infohash', 'dir', 'name', 'sequence', 'seed', 'address', 'secret']) {
                if (torrentData[test]) {
                  useHead['X-' + test.charAt(0).toUpperCase() + test.slice(1)] = torrentData[test]
                }
              }
              const useIden = torrentData.address || torrentData.infohash || torrentData.msg || torrentData.id
              const useLink = `bt://${torrentData.id}${torrentData.path}`
              useHead['X-Link'] = `bt://${useIden}${torrentData.path}`
              useHead['Link'] = `<${useHead['X-Link']}>; rel="canonical"`
        
              return new Response(mainReq ? `<html><head><title>${useIden}</title></head><body><div>${useLink}</div></body></html>` : JSON.stringify(useLink), {status: 200, headers: {...mainHeaders, 'Content-Type': mainRes, ...useHead}})
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
      app.off('err', handleErr)
      for (const data of app.webtorrent.torrents) {
        await new Promise((resolve, reject) => {
          data.destroy({ destroyStore: false }, (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        })
      }
      app.checkId.clear()
      clearInterval(app.session)
      return await new Promise((resolve, reject) => {
        app.webtorrent.destroy(error => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
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

    return {handler: makeBt, close}
  }