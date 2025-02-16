export default async function makeTopicFetch (opts = {}) {
  const errLog = opts.err
    const { Readable, pipelinePromise } = await import('streamx')
    const fs = await import('fs/promises')
    const fse = await import('fs-extra')
    const { EventIterator } = await import('event-iterator')
    const path = await import('path')
    const DEFAULT_OPTS = {timeout: 30000}
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    const block = finalOpts.block
    const storage = finalOpts.storage
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

    if(!await fse.pathExists(storage)){
      await fse.ensureDir(storage)
    }

    const app = await (async () => {if(finalOpts.sdk){return finalOpts.sdk}else{const SDK = await import('hyper-sdk');const sdk = await SDK.create(finalOpts);return sdk;}})()
    if(!await fse.pathExists(path.join(storage, 'block.txt'))){
      await fs.writeFile(path.join(storage, 'block.txt'), JSON.stringify([]))
    }
    const blockList = block ? JSON.parse((await fs.readFile(path.join(storage, 'block.txt'))).toString('utf-8')) : null

    const current = new Map()
    const connection = new Map()
    const line = new Map()

    function handle(socket, relay){
      const pub = socket.publicKey.toString('hex')
      const peerKey = relay.publicKey
      socket.peerKey = peerKey
      if(!socket.ids){
        socket.ids = new Set()
      }
      for(const topic of relay.topics){
        const bufToStr = topic.toString()
        if(current.has(bufToStr)){
          if(!connection.has(pub)){
            connection.set(pub, socket)
          }
          const test = current.get(bufToStr)
          if(!test.ids.has(pub)){
            test.ids.add(pub)
          }
          if(!socket.ids.has(bufToStr)){
            socket.ids.add(bufToStr)
          }
          if(!test.peers.has(peerKey)){
            test.peers.add(peerKey)
          }
        }
      }
      if(connection.has(pub)){
        if(!socket.funcs){
          function handleData(data){
            test.push({peer: peerKey, data})
          }
          function handleErr(err){
            test.fail(err)
          }
          function handler(){
            socket.off('data', handleData)
            socket.off('error', handleErr)
            socket.off('close', handler)
        }
        socket.on('data', handleData)
        socket.on('error', handleErr)
        socket.on('close', handler)
        socket.funcs = true
        }
      }
      if(!line.has(peerKey, socket)){
        line.set(peerKey, socket)
      }
    }

    app.swarm.on('connection', handle)

    async function makeTopic(session){
      try {
      const mainURL = new URL(session.url)
      const body = session.body
      const method = session.method
      const headers = session.headers
      const search = mainURL.searchParams

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
          const buf = Buffer.alloc(32).fill(mainURL.hostname)
          const str = buf.toString()
          if(!current.has(str)){
            iter(str, buf)
          }
          if(headers.has('x-iden') && JSON.parse(headers.get('x-iden'))){
            const {peers} = current.has(str)
            const arr = []
            for(const i of peers){
              arr.push(i)
            }
            const rand = arr[Math.floor(Math.random() * arr.length)]
            if(rand){
              return new Response(null, {status: 200, headers: {'X-Iden': rand}})
            } else {
              return new Response(null, {status: 400})
            }
          } else {
            return new Response(null, {status: 200})
          }
        } else if(method === 'GET'){
        const buf = Buffer.alloc(32).fill(mainURL.hostname)
        const str = buf.toString()
        if(!current.has(str)){
          iter(str, buf)
        }
        const obj = current.get(mainURL.hostname)
        if(headers.has('x-iden') && JSON.parse(headers.get('x-iden'))){
          const arr = []
          for(const i of obj.peers){
            arr.push(i)
          }
          return new Response(JSON.stringify(arr), {status: 200})
        } else {
          return new Response(obj.events, {status: 200})
        }
      } else if(method === 'POST'){
        const id = headers.has('x-iden') || search.has('x-iden') ? headers.get('x-iden') || search.get('x-iden') : null
        const buf = Buffer.alloc(32).fill(mainURL.hostname)
        const str = buf.toString()
        if(!current.has(str)){
            iter(str, buf)
        }
        if(id){
          if(line.has(id)){
            line.get(id).write(await toBuff(body))
          }
        } else {
          const test = current.get(str)
          for(const prop of test.ids){
            if(connection.has(prop)){
              connection.get(prop).write(await toBuff(body))
            }
          }
        }
        return new Response(null, {status: 200})
      } else if(method === 'DELETE'){
        const str = Buffer.alloc(32).fill(mainURL.hostname).toString()
        if(current.has(str)){
          const test = current.get(str)
          test.stop()
          current.delete(str)
          return new Response(str, {status: 200})
        } else {
          return new Response(str, {status: 400})
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

    function iter(hostname, bufOFStr){
      const obj = {}
      obj.ids = new Set()
      obj.peers = new Set()
      obj.events =  new EventIterator(({ push, fail, stop }) => {
          obj.push = push
          obj.fail = fail
          obj.stop = stop
          // obj.status = false
          // const disc = app.swarm.join(mainURL.hostname, {})
          app.swarm.join(bufOFStr, {})
          return () => {
              // disc.destroy().then(console.log).catch(console.error)
              app.swarm.leave(bufOFStr).then(console.log).catch(console.error)
              // if(current.has(hostname)){
                const testing = current.get(hostname)
                for(const prop of testing.ids){
                  if(connection.has(prop)){
                    const soc = connection.get(prop)
                    if(soc.ids.has(hostname)){
                      soc.ids.delete(hostname)
                      if(!soc.ids.size){
                        if(line.has(soc.peerKey)){
                          line.delete(soc.peerKey)
                        }
                        soc.destroy()
                        connection.delete(prop)
                      }
                    }
                  }
                }
              // }
              current.delete(hostname)
              // stop()
          }
      })
      current.set(hostname, obj)
      return obj
    }
  
    async function close(){
        app.swarm.off('connection', handle)
        for(const cur of current.values()){
          cur.stop()
        }
        for(const soc of connection.values()){
          soc.destroy()
        }
        current.clear()
        connection.clear()
        return
    }

    async function toBuff(data){
      const chunks = []
      for await (let chunk of data) {
        chunks.push(chunk)
      }
      return Buffer.concat(chunks)
    }

    function intoStream (data) {
      return new Readable({
        read () {
          this.push(data)
          this.push(null)
        }
      })
    }

    return {handler: makeTopic, close}
  }