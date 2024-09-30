export default async function makeMessageFetch (opts = {}) {
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
  
    const app = await (async () => {if(finalOpts.torrentz){return finalOpts.torrentz}else{const {default: torrentzFunc} = await import('torrentz');const Torrentz = await torrentzFunc();return new Torrentz(finalOpts);}})()
    if(!await fse.pathExists(path.join(dir, 'block.txt'))){
      await fs.writeFile(path.join(dir, 'block.txt'), JSON.stringify([]))
    }
    const blockList = block ? JSON.parse((await fs.readFile(path.join(dir, 'block.txt'))).toString('utf-8')) : null

    const current = new Map()

    async function makeMessage(session){
      try {
        const mainURL = new URL(session.url)
        const body = session.body
        const method = session.method
        if(!mainURL.hostname){
            throw new Error('must have hostname')
        }
        if(!app.checkId.has(mainURL.hostname)){
            throw new Error('torrent is not ready')
        }
        if(block && blockList.includes(mainURL.hostname)){
            throw new Error('id is blocked')
        }
        if(method === 'GET'){
            if(current.has(mainURL.hostname)){
                throw new Error('currently subscribed')
            } else {
              const torrent = app.checkId.get(mainURL.hostname)
              const obj = {}
              const events = new EventIterator(({ push, fail, stop }) => {
                  obj.push = push
                  obj.fail = fail
                  obj.stop = stop
                  function handle () {
                      torrent.off('message', push)
                      torrent.off('over', handle)
                      current.delete(mainURL.hostname)
                      stop()
                  }
                  torrent.on('message', push)
                  torrent.on('over', handle)
                  obj.func = () => {
                    torrent.off('message', push)
                    torrent.off('over', handle)
                  }
                  current.set(mainURL.hostname, obj)
                  return () => {
                      torrent.off('message', push)
                      torrent.off('over', handle)
                      current.delete(mainURL.hostname)
                      stop()
                  }
                })
                return new Response(events, {status: 200})
            }
        } else if(method === 'POST'){
            const torrent = app.checkId.get(mainURL.hostname)
            torrent.say(body)
            return new Response(null, {status: 200})
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

    return {handler: makeMessage, close}
  }