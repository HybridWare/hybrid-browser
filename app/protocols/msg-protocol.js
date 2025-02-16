export default async function makeMsgFetch (opts = {}) {
  const errLog = opts.err
    const path = await import('path')
    const fs = await import('fs/promises')
    const {Readable} = await import('stream')
    const fse = await import('fs-extra')
    const { EventIterator } = await import('event-iterator')
    const DEFAULT_OPTS = {timeout: 30000}
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
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
    if(!await fse.pathExists(path.join(dir, 'block.txt'))){
      await fs.writeFile(path.join(dir, 'block.txt'), JSON.stringify([]))
    }
    const blockList = block ? JSON.parse((await fs.readFile(path.join(dir, 'block.txt'))).toString('utf-8')) : null

    const current = new Map()

    async function makeMsg(session){
      try {
        const mainURL = new URL(session.url)
        const body = session.body
        const method = session.method
        const useHeaders = session.headers
        const useSearch = mainURL.searchParams
  
        if(mainURL.pathname !== '/'){
          throw new Error('path must be /')
        }
        if(!mainURL.hostname){
            throw new Error('must have hostname')
        }
        if(block && blockList.includes(mainURL.hostname)){
            throw new Error('id is blocked')
        }
        if(method === 'HEAD'){
          if(!current.has(mainURL.hostname)){
            const {torrent} = await app.loadTorrent(mainURL.hostname, mainURL.pathname, {torrent: true, buf: useHeaders.has('x-buf') ? JSON.parse(useHeaders.get('x-buf')) : false})
            const obj = {}
            current.set(mainURL.hostname, obj)
            obj.torrent = torrent
            obj.events = new EventIterator(({ push, fail, stop }) => {
              obj.push = push
              obj.fail = fail
              obj.stop = stop
              function handle () {
                  // torrent.off('msg', push)
                  // torrent.off('over', handle)
                  // current.delete(mainURL.hostname)
                  stop()
              }
              torrent.on('msg', push)
              torrent.on('over', handle)
              // obj.func = () => {
              //   torrent.off('msg', push)
              //   torrent.off('over', handle)
              // }
              return () => {
                  torrent.off('msg', push)
                  torrent.off('over', handle)
                  current.delete(mainURL.hostname)
                  // stop()
              }
            })
          }
          const {torrent} = current.get(mainURL.hostname)
          if(useHeaders.has('x-iden') && JSON.parse(useHeaders.get('x-iden'))){
            const arr = torrent.allUsers()
            const rand = arr[Math.floor(Math.random() * arr.length)]
            if(rand){
              return new Response(null, {status: 200, headers: {'X-Iden': rand}})
            } else {
              return new Response(null, {status: 400})
            }
          } else {
            return new Response(null, {status: 200, headers: {'X-Hash': torrent.infoHash}})
          }
        } else if(method === 'GET'){
            if(!current.has(mainURL.hostname)){
              const {torrent} = await app.loadTorrent(mainURL.hostname, mainURL.pathname, {torrent: true, buf: useHeaders.has('x-buf') ? JSON.parse(useHeaders.get('x-buf')) : false})
              const obj = {}
              obj.torrent = torrent
              obj.events = new EventIterator(({ push, fail, stop }) => {
                obj.push = push
                obj.fail = fail
                obj.stop = stop
                function handle () {
                    // torrent.off('msg', push)
                    // torrent.off('over', handle)
                    // current.delete(mainURL.hostname)
                    stop()
                }
                torrent.on('msg', push)
                torrent.on('over', handle)
                // obj.func = () => {
                //   torrent.off('msg', push)
                //   torrent.off('over', handle)
                // }
                return () => {
                    torrent.off('msg', push)
                    torrent.off('over', handle)
                    current.delete(mainURL.hostname)
                    // stop()
                }
              })
              current.set(mainURL.hostname, obj)
            }
            const obj = current.get(mainURL.hostname)
            if(useHeaders.has('x-iden') && JSON.parse(useHeaders.get('x-iden'))){
              return new Response(JSON.stringify(obj.torrent.allUsers()), {status: 200, headers: {'X-Hash': obj.torrent.infoHash}})
            } else {
              return new Response(obj.events, {status: 200, headers: {'X-Hash': obj.torrent.infoHash}})
            }
        } else if(method === 'POST'){
          const id = useHeaders.has('x-iden') || useSearch.has('x-iden') ? useHeaders.get('x-iden') || useSearch.get('x-iden') : null
          if(!current.has(mainURL.hostname)){
            const {torrent} = await app.loadTorrent(mainURL.hostname, mainURL.pathname, {torrent: true, buf: useHeaders.has('x-buf') ? JSON.parse(useHeaders.get('x-buf')) : false})
            const obj = {}
            current.set(mainURL.hostname, obj)
            obj.torrent = torrent
            obj.events = new EventIterator(({ push, fail, stop }) => {
              obj.push = push
              obj.fail = fail
              obj.stop = stop
              function handle () {
                  // torrent.off('msg', push)
                  // torrent.off('over', handle)
                  // current.delete(mainURL.hostname)
                  stop()
              }
              torrent.on('msg', push)
              torrent.on('over', handle)
              // obj.func = () => {
              //   torrent.off('msg', push)
              //   torrent.off('over', handle)
              // }
              return () => {
                  torrent.off('msg', push)
                  torrent.off('over', handle)
                  current.delete(mainURL.hostname)
                  // stop()
              }
            })
          }
          const obj = current.get(mainURL.hostname)
          obj.torrent.say(await toBody(body, useHeaders.has('buf') ? JSON.parse(useHeaders.get('buf')) : null), id)
          return new Response(null, {status: 200, headers: {'X-Hash': obj.torrent.infoHash}})
        } else if(method === 'DELETE'){
          if(current.has(mainURL.hostname)){
            const obj = current.get(mainURL.hostname)
            // const hash = obj.torrent.infoHash
            obj.stop()
            current.delete(mainURL.hostname)
            let test
            if(useHeaders.has('x-shred') && JSON.parse(useHeaders.get('x-shred'))){
              test = await app.shredTorrent(mainURL.hostname, mainURL.pathname, {buf: useHeaders.has('x-buf') ? JSON.parse(useHeaders.get('x-buf')) : false})
            } else {
              test = mainURL.hostname
            }
            return new Response(test, {status: 200, headers: {'X-Hash': hash}})
          } else {
            // const test = await app.shredTorrent({msg: mainURL.hostname}, mainURL.pathname, {})
            return new Response(null, {status: 200})
          }
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

    async function toBody(body, buf){
      const arr = []
      for await (const data of body){
        arr.push(data)
      }
      return buf ? Buffer.concat(arr) : Buffer.concat(arr).toString()
    }
  
    async function close(){
        current.forEach((e) => {
          // e.func()
          e.stop()
        })
        current.clear()
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

    return {handler: makeMsg, close}
  }