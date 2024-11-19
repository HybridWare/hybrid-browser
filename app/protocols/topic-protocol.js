export default async function makeTopicFetch (opts = {}) {
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

    function handle(socket, relay){
      for(const topic of relay.topics){
        const bufToStr = topic.toString()
        if(current.has(bufToStr)){
          if(!socket.ids){
            socket.ids = new Set()
          }
          const pub = socket.publicKey.toString('hex')
          if(!connection.has(pub)){
            connection.set(pub, socket)
          }
          const test = current.get(bufToStr)
          if(!test.ids.has(pub)){
            test.ids.add(pub)
            function handler(){
              socket.off('data', test.push)
              socket.off('error', test.fail)
              socket.off('close', handler)
              connection.delete(pub)
              // for(const p of socket.ids.values()){
              //   //
              // }
              // delete test.ids[socket.publicKey.toString('hex')]
          }
          socket.on('data', test.push)
          socket.on('error', test.fail)
          socket.on('close', handler)
          }
          if(!socket.ids.has(bufToStr)){
            socket.ids.add(bufToStr)
          }
        }
      }
    }

    app.swarm.on('connection', handle)

    async function makeTopic(session){
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
        const buf = Buffer.alloc(32).fill(mainURL.hostname)
        const str = buf.toString()
        if(current.has(str)){
          const test = current.get(str)
          return new Response(test.events, {status: 200})
        } else {
          const test = iter(str, buf)
          return new Response(test.events, {status: 200})
        }
      } else if(method === 'POST'){
        const buf = Buffer.alloc(32).fill(mainURL.hostname)
        const str = buf.toString()
        if(current.has(str)){
          const test = current.get(str)
          for(const prop in test.ids.values()){
            if(connection.has(prop)){
              connection.get(prop).write(await toBuff(body))
            }
          }
          return new Response(null, {status: 200})
        } else {
            const test = iter(str, buf)
            for(const prop in test.ids.values()){
              if(connection.has(prop)){
                connection.get(prop).write(await toBuff(body))
              }
            }
            return new Response(test.events, {status: 200})
        }
      } else if(method === 'DELETE'){
        const buf = Buffer.alloc(32).fill(mainURL.hostname)
        const str = buf.toString()
        if(current.has(str)){
          const test = current.get(str)
          test.stop()
          // current.delete(str)
          return new Response(str, {status: 200})
        } else {
          return new Response(str, {status: 400})
        }
      } else {
        return new Response('invalid method', {status: 400, headers: mainHeaders})
      }
      } catch (error) {
        console.error(error)
        return new Response(intoStream(error.stack), {status: 500, headers: mainHeaders})
      }
    }

    function iter(hostname, bufOFStr){
      const obj = {}
      current.set(hostname, obj)
      obj.ids = new Set()
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
              if(current.has(hostname)){
                const testing = current.get(hostname)
                for(const prop in testing.ids.values()){
                  if(connection.has(prop)){
                    const soc = connection.get(prop)
                    if(soc.ids.has(hostname)){
                      soc.ids.delete(hostname)
                      if(!soc.ids.size){
                        soc.destroy()
                      }
                    }
                  }
                }
              }
              current.delete(hostname)
              // stop()
          }
      })
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