export default async function makeHyperFetch (opts = {}) {
    const {default: mime} = await import('mime')
    const {default: parseRange} = await import('range-parser')
    const { Readable, pipelinePromise } = await import('streamx')
    const fs = await import('fs/promises')
    // const fse = await import('fs-extra')
    const path = await import('path')
    const DEFAULT_OPTS = {timeout: 30000}
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    const block = finalOpts.block
    const storage = finalOpts.storage
    const hyperTimeout = finalOpts.timeout
    const hostType = '_'
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

    const app = await (async (finalOpts) => {if(finalOpts.sdk){return finalOpts.sdk}else{const SDK = await import('hyper-sdk');const sdk = await SDK.create(finalOpts);return sdk;}})(finalOpts)
    if(!await pathExists(path.join(storage, 'block.txt'))){
      await fs.writeFile(path.join(storage, 'block.txt'), JSON.stringify([]))
    }
    const blockList = block ? JSON.parse((await fs.readFile(path.join(storage, 'block.txt'))).toString('utf-8')) : null
  
    const drives = new Map()
    const id = await (async () => {
      const drive = await app.getDrive('id')
      const check = drive.key.toString('hex')
      drives.set(check, drive)
      return check
    })()
  
    async function checkForDrive(prop){
      if(drives.has(prop)){
        return drives.get(prop)
      }
      const drive = await app.getDrive(prop)
      drives.set(drive.key.toString('hex'), drive)
      return drive
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
  
    function formatReq(hostname, pathname){
  
      const useData = {query: hostname === hostType}
      if(useData.query){
        useData.useHost = id
      } else {
        useData.useHost = hostname
      }
      useData.usePath = decodeURIComponent(pathname)
      return useData
    }

    function handleFormData(formdata){
        const arr = []
        for (const info of formdata.values()) {
          if (info.stream) {
            arr.push(info)
          }
        }
        return arr
    }
  
    async function saveFileData(drive, title, main, body, useOpt) {
      await pipelinePromise(Readable.from(body), drive.createWriteStream(main.usePath, useOpt))
      return 'hyper://' + path.join(title, main.usePath, info.webkitRelativePath || info.name).replace(/\\/g, "/")
    }
  
    async function saveFormData(drive, title, mid, data, useOpts) {
      const arr = []
      for (const info of data) {
        const str = path.join(mid.usePath, info.webkitRelativePath || info.name).replace(/\\/g, "/")
        await pipelinePromise(Readable.from(info.stream()), drive.createWriteStream(str, useOpts))
        arr.push('hyper://' + path.join(title, str).replace(/\\/g, "/"))
      }
      return arr
    }
  
    function getMimeType (path) {
      let mimeType = mime.getType(path) || 'text/plain'
      if (mimeType.startsWith('text/')) mimeType = `${mimeType}; charset=utf-8`
      return mimeType
    }

    async function stat(drive, query){
      if (path.extname(query.usePath)) {
        const useDatas = await drive.entry(query.usePath)
        if (useDatas) {
          useDatas.directory = false
          return useDatas
        } else {
          throw new Error('Path did not find any resource')
        }
      } else {
        return {directory: true}
      }
    }

    async function makeHyper(session){
      try {
      // const session = new Request(url, opt)
      const mainURL = new URL(session.url)
      const reqHeaders = session.headers
      const searchParams = mainURL.searchParams
      const body = session.body
      const method = session.method
      const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : 0 : hyperTimeout
      const main = formatReq(decodeURIComponent(mainURL.hostname), decodeURIComponent(mainURL.pathname))
      const isItBlock = block && !main.query && blockList.includes(main.useHost)

      if(method === 'HEAD'){
          const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
          const useOpts = { ...useOpt, timeout: mainTimeout }

          if(reqHeaders.has('x-block') || searchParams.has('x-block')){
            if(JSON.parse(reqHeaders.get('x-block') || searchParams.get('x-block'))){
              if(blockList.includes(main.useHost)){
                return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'already blocked'}})
              } else {
                const mainKid = drives.get(main.useHost)
                if(mainKid){
                  await mainKid.purge()
                  await mainKid.close()
                  drives.delete(main.useHost)
                }

                blockList.push(main.useHost)
                await fs.writeFile(path.join(storage, 'block.txt'), JSON.stringify(blockList))
                const useLink = `hyper://${main.useHost}/`

                return new Response(null, { status: 200, headers: {...mainHeaders, 'X-Status': 'now blocking', 'X-Link': useLink}})
              }
            } else {
              if(!blockList.includes(main.useHost)){
                return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'already unblocked'}})
              } else {
                blockList.splice(blockList.indexOf(main.useHost), 1)
                await fs.writeFile(path.join(storage, 'block.txt'), JSON.stringify(blockList))
                return new Response(null, { status: 200, headers: {...mainHeaders, 'X-Status': 'now unblocking'}})
              }
            }
          } else if (reqHeaders.has('x-copy') || searchParams.has('x-copy')) {
            if(isItBlock){
              return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
            }
            const useDrive = await waitForStuff({ num: useOpts.timeout, msg: 'drive' }, checkForDrive(main.useHost))
            const useData = await stat(useDrive, main)
            if(useData.directory){
              const useIdenPath = JSON.parse(reqHeaders.get('x-copy') || searchParams.get('x-copy')) ? `/${useDrive.key.toString('hex')}` : '/'
              const mainDrive = await checkForDrive(id)
              let useNum = 0
              for await (const test of useDrive.list(main.usePath)) {
                useNum = useNum + test.value.blob.byteLength
                const pathToFile = path.join(useIdenPath, test.key).replace(/\\/g, "/")
                await mainDrive.put(pathToFile, await useDrive.get(test.key))
              }
              const pathToFolder = path.join(useIdenPath, main.usePath).replace(/\\/g, "/")
              const useHeaders = {}
              useHeaders['X-Link'] = 'hyper://_' + pathToFolder.replace(/\\/g, "/")
              useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
              return new Response(null, { status: 200, headers: { ...mainHeaders, 'Content-Length': `${useNum}`, ...useHeaders } })
            } else {
              const pathToFile = JSON.parse(reqHeaders.get('x-copy') || searchParams.get('x-copy')) ? path.join(`/${useDrive.key.toString('hex')}`, useData.key).replace(/\\/g, "/") : useData.key
              const mainDrive = await checkForDrive(id)
              await mainDrive.put(pathToFile, await useDrive.get(useData.key))
              const useHeaders = {}
              useHeaders['X-Link'] = 'hyper://_' + pathToFile.replace(/\\/g, "/")
              useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
              return new Response(null, { status: 200, headers: { ...mainHeaders, 'Content-Length': `${useData.value.blob.byteLength}`, ...useHeaders } })
            }
          } else if (reqHeaders.has('x-load') || searchParams.has('x-load')) {
            if(isItBlock){
              return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
            }
            const useDrive = await waitForStuff({ num: useOpts.timeout, msg: 'drive' }, checkForDrive(main.useHost))
            const useData = await stat(useDrive, main)
            if (JSON.parse(reqHeaders.get('x-load') || searchParams.get('x-load'))) {
              if(useData.directory){
                await useDrive.download(main.usePath, useOpts)
                const useHeaders = {}
                useHeaders['X-Link'] = `hyper://${useDrive.key.toString('hex')}${main.usePath}`
                useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
                return new Response(null, { status: 200, headers: { ...mainHeaders, 'Content-Length': '0', ...useHeaders } })
              } else {
                await useDrive.get(useData.key)
                const useHeaders = {}
                useHeaders['X-Link'] = `hyper://${useDrive.key.toString('hex')}${useData.key}`
                useHeaders['Link'] = `<${useHeaders['X-Link']}>; rel="canonical"`
                return new Response(null, { status: 200, headers: { ...mainHeaders, 'Content-Length': `${useData.value.blob.byteLength}`, ...useHeaders } })
              }
            } else {
              if(useData.directory){
                for await (const test of useDrive.list(main.usePath)){
                  await useDrive.del(test.key)
                }
                const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), main.usePath).replace(/\\/g, '/')
                return new Response(null, { status: 200, headers: { ...mainHeaders, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` }})
              } else {
                await useDrive.del(main.usePath)
                const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), main.usePath).replace(/\\/g, '/')
                return new Response(null, {status: 200, headers: {...mainHeaders, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`}})
              }
            }
          } else {
            if(isItBlock){
              return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
            }
            const useDrive = await waitForStuff({num: useOpts.timeout, msg: 'drive'}, checkForDrive(main.useHost))
            const useData = await stat(useDrive, main)
            const useKey = useDrive.key.toString('hex')
            if(useData.directory){
              let useNum = 0
              for await (const test of useDrive.list(main.usePath)) {
                useNum = useNum + test.value.blob.byteLength
              }
              const useLink = 'hyper://' + path.join(useKey, main.usePath).replace(/\\/g, "/")
              return new Response(null, { status: 200, headers: { ...mainHeaders, 'X-Canon': useKey, 'Content-Length': String(useNum), 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` } })
            } else {
              const useLink = 'hyper://' + path.join(useKey, useData.key).replace(/\\/g, "/")
              return new Response(null, { status: 200, headers: { ...mainHeaders, 'X-Canon': useKey, 'Content-Length': String(useData.value.blob.byteLength), 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` } })
            }
          }
      } else if(method === 'GET'){
        if(isItBlock){
          return new Response(null, { status: 400, headers: {...mainHeaders, 'X-Error': 'block'}})
        }
          const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
          const useOpts = { ...useOpt, timeout: mainTimeout }
      
          const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
          const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
      
          const useDrive = await waitForStuff({num: useOpts.timeout, msg: 'drive'}, checkForDrive(main.useHost))
          const useData = await stat(useDrive, main)
          const useKey = useDrive.key.toString('hex')
          
          if(useData.directory){
            const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), main.usePath).replace(/\\/g, "/")
              const arr = []
            for await (const test of useDrive.readdir(main.usePath)) {
                arr.push(path.join('/', test).replace(/\\/g, '/'))
              }
            return new Response(mainReq ? `<html><head><title>${main.usePath}</title></head><body><div><p><a href='../'>..</a></p>${arr.map((data) => {return `<p><a href="${data}">${data}</a></p>`})}</div></body></html>` : JSON.stringify(arr), {status: 200, headers: {...mainHeaders, 'X-Canon': useKey, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Type': mainRes}})
          } else {
            const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), useData.key).replace(/\\/g, "/")
            const isRanged = reqHeaders.has('Range') || reqHeaders.has('range')
            if(isRanged){
              const ranges = parseRange(useData.value.blob.byteLength, reqHeaders.get('Range') || reqHeaders.get('range'))
              // if (ranges && ranges.length && ranges.type === 'bytes') {
              if ((ranges !== -1 && ranges !== -2) && ranges.type === 'bytes') {
                const [{ start, end }] = ranges
                const length = (end - start + 1)
                return new Response(useDrive.createReadStream(useData.key, {start, end}), {status: 206, headers: {...mainHeaders, 'X-Canon': useKey, 'Content-Type': getMimeType(useData.key), 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${length}`, 'Content-Range': `bytes ${start}-${end}/${useData.value.blob.byteLength}`}})
              } else {
                return new Response(mainReq ? '<html><head><title>range</title></head><body><div><p>malformed or unsatisfiable range</p></div></body></html>' : JSON.stringify('malformed or unsatisfiable range'), {status: 416, headers: {...mainHeaders, 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${useData.value.blob.byteLength}`}})
              }
            } else {
              return new Response(useDrive.createReadStream(useData.key), {status: 200, headers: {...mainHeaders, 'X-Canon': useKey, 'Content-Type': getMimeType(useData.key), 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${useData.value.blob.byteLength}`}})
            }
          }
      } else if(method === 'POST'){
          const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
          const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
          
          const useDrive = await checkForDrive(main.useHost)
          const useName = useDrive.key.toString('hex')
          const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
          const getSaved = reqHeaders.has('content-type') && reqHeaders.get('content-type').includes('multipart/form-data') ? await saveFormData(useDrive, useName, main, handleFormData(await session.formData()), useOpt) : await saveFileData(useDrive, useName, main, body, useOpt)
          // const useName = useDrive.key.toString('hex')
          // const saved = 'hyper://' + path.join(useName, main.usePath).replace(/\\/g, '/')
          const useLink = 'hyper://' + path.join(useName, main.usePath).replace(/\\/g, '/')
            return new Response(mainReq ? `<html><head><title>Fetch</title></head><body><div>${Array.isArray(getSaved) ? JSON.stringify(getSaved) : getSaved}</div></body></html>` : JSON.stringify(getSaved), {status: 200, headers: {...mainHeaders, 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`}})
      } else if(method === 'DELETE'){
          const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
          const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
          
          const useDrive = await checkForDrive(main.useHost)
          const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
          if (path.extname(main.usePath)) {
            const useData = await useDrive.entry(main.usePath)
            if (useData) {
              await useDrive.del(useData.key)
              const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), useData.key).replace(/\\/g, '/')
              useOpt.deleted = 'success'
              return new Response(mainReq ? `<html><head><title>Fetch</title></head><body><div>${useLink}</div></body></html>` : JSON.stringify(useLink), {status: 200, headers: {...mainHeaders, 'Status': useOpt.deleted, 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${useData.value.blob.byteLength}`}})
            } else {
              return new Response(mainReq ? '<html><head><title>range</title></head><body><div><p>did not find any file</p></div></body></html>' : JSON.stringify('did not find any file'), { status: 400, headers: { ...mainHeaders, 'Content-Type': mainRes } })
            }
          } else {
              let useNum = 0
              for await (const test of useDrive.list(main.usePath)){
                useNum = useNum + test.value.blob.byteLength
                await useDrive.del(test.key)
            }
            const useLink = 'hyper://' + path.join(useDrive.key.toString('hex'), main.usePath).replace(/\\/g, '/')
            return new Response(mainReq ? `<html><head><title>Fetch</title></head><body><div>${useLink}</div></body></html>` : JSON.stringify(useLink), { status: 200, headers: { ...mainHeaders, 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${useNum}` } })
          }
      } else {
        return new Response('invalid method', {status: 400, headers: mainHeaders})
      }
      } catch (error) {
        console.error(error)
        return new Response(intoStream(error.stack), {status: 500, headers: mainHeaders})
      }
    }
  
    async function close(){
        for (const drive of drives.values()) {
            await drive.close()
        }
        drives.clear()
        return await app.close()
    }

    function intoStream (data) {
      return new Readable({
        read () {
          this.push(data)
          this.push(null)
        }
      })
    }

    return {handler: makeHyper, close}
  }