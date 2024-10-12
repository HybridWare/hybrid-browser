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

    function handle(socket, relay){
      relay.topics.forEach((topic) => {
          if(current.has(topic)){
              const test = current.get(topic)
              function handler(){
                  socket.off('data', test.push)
                  socket.off('error', test.fail)
                  socket.off('close', handler)
              }
              socket.on('data', test.push)
              socket.on('error', test.fail)
              socket.on('close', handler)
              test.ids.add(socket.publicKey)
          }
      })
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
        if(current.has(mainURL.hostname)){
          const test = current.get(mainURL.hostname)
          return new Response(test.events, {status: 200})
        } else {
          const test = iter(mainURL.hostname)
          return new Response(test.events, {status: 200})
        }
      } else if(method === 'POST'){
        if(current.has(mainURL.hostname)){
          const test = current.get(mainURL.hostname)
          test.ids.forEach((i) => {
            if(app.connections.has(i)){
              app.connections.get(i).write(body)
            }
          })
          return new Response(null, {status: 200})
        } else {
            const test = iter(mainURL.hostname)
            test.ids.forEach((i) => {
              if(app.connections.has(i)){
                app.connections.get(i).write(body)
              }
            })
            return new Response(test.events, {status: 200})
        }
      } else if(method === 'DELETE'){
        if(current.has(mainURL.hostname)){
          const test = current.get(mainURL.hostname)
          test.stop()
          current.delete(mainURL.hostname)
          return new Response(mainURL.hostname, {status: 200})
        } else {
          return new Response(mainURL.hostname, {status: 400})
        }
      } else {
        return new Response('invalid method', {status: 400, headers: mainHeaders})
      }
      } catch (error) {
        console.error(error)
        return new Response(intoStream(error.stack), {status: 500, headers: mainHeaders})
      }
    }

    function iter(hostname){
      const buf = Buffer.concat([Buffer.from(hostname)], 32)
      const obj = {ids: new Set()}
      obj.events =  new EventIterator(({ push, fail, stop }) => {
          obj.push = push
          obj.fail = fail
          obj.stop = stop
          // obj.status = false
          // const disc = app.swarm.join(mainURL.hostname, {})
          app.swarm.join(buf, {})
          return () => {
              // disc.destroy().then(console.log).catch(console.error)
              app.swarm.leave(buf).then(console.log).catch(console.error)
              const testing = current.get(hostname)
              if(testing.ids){
                testing.ids.forEach((e) => {
                  if(app.connections.has(e)){
                      app.connections.get(e).destroy()
                  }
                })
              }
              testing.ids.clear()
              current.delete(hostname)
              stop()
          }
        })
        current.set(hostname, obj)
        return obj
    }
  
    async function close(){
        app.swarm.off('connection', handle)
        current.forEach((e) => {
          e.ids.forEach((i) => {
            if(app.connections.has(i)){
              app.connections.get(i).destroy()
            }
          })
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

    return {handler: makeTopic, close}
  }