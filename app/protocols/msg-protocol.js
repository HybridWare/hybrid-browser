export default async function makeMsgFetch (opts = {}) {
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
        if(!mainURL.hostname){
            throw new Error('must have hostname')
        }
        if(block && blockList.includes(mainURL.hostname)){
            throw new Error('id is blocked')
        }
        if(method === 'GET'){
            if(current.has(mainURL.hostname)){
              const obj = current.get(mainURL.hostname)
              return new Response(obj.events, {status: 200})
            } else {
              const {torrent} = await app.loadTorrent(mainURL.hostname, mainURL.pathname, {torrent: true})
              const obj = {}
              obj.events = new EventIterator(({ push, fail, stop }) => {
                obj.push = push
                obj.fail = fail
                obj.stop = stop
                function handle () {
                    torrent.off('msg', push)
                    torrent.off('over', handle)
                    current.delete(mainURL.hostname)
                    stop()
                }
                torrent.on('msg', push)
                torrent.on('over', handle)
                obj.func = () => {
                  torrent.off('msg', push)
                  torrent.off('over', handle)
                }
                return () => {
                    torrent.off('msg', push)
                    torrent.off('over', handle)
                    current.delete(mainURL.hostname)
                    stop()
                }
              })
              current.set(mainURL.hostname, obj)
              return new Response(obj.events, {status: 200})
            }
        } else if(method === 'POST'){
          if(app.checkId.has(mainURL.hostname)){
            const torrent = app.checkId.get(mainURL.hostname)
            if(torrent.say){
              torrent.say(body)
            }
            return new Response(null, {status: 200})
          } else {
            const {torrent} = await app.loadTorrent(mainURL.hostname, mainURL.pathname, {torrent: true})
            const obj = {}
            obj.events = new EventIterator(({ push, fail, stop }) => {
              obj.push = push
              obj.fail = fail
              obj.stop = stop
              function handle () {
                  torrent.off('msg', push)
                  torrent.off('over', handle)
                  current.delete(mainURL.hostname)
                  stop()
              }
              torrent.on('msg', push)
              torrent.on('over', handle)
              obj.func = () => {
                torrent.off('msg', push)
                torrent.off('over', handle)
              }
              return () => {
                  torrent.off('msg', push)
                  torrent.off('over', handle)
                  current.delete(mainURL.hostname)
                  stop()
              }
            })
            current.set(mainURL.hostname, obj)
            if(torrent.say){
              torrent.say(body)
            }
            return new Response(null, {status: 200})
          }
        } else if(method === 'DELETE'){
          if(current.has(mainURL.hostname)){
            const test = current.get(mainURL.hostname)
            test.stop()
            current.delete(mainURL.hostname)
            return new Response(mainURL.hostname, {status: 200})
          } else {
            const test = await app.shredTorrent({msg: mainURL.hostname}, mainURL.pathname, {})
            return new Response(test.id, {status: 400})
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
        current.forEach((e) => {
          e.func()
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