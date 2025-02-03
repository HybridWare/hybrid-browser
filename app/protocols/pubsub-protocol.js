export default async function makePubsubFetch (opts = {}) {
    const {default: Room} = await import('ipfs-pubsub-room')
    const { Readable } = await import('streamx')
    const path = await import('path')
    const fs = await import('fs/promises')
    const fse = await import('fs-extra')
    const { EventIterator } = await import('event-iterator')
    const DEFAULT_OPTS = {timeout: 30000}
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    const block = finalOpts.block
    const repo = finalOpts.repo
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

    if(!await fse.pathExists(repo)){
      await fse.ensureDir(repo)
    }
    
    const app = await (async () => { if (finalOpts.helia) { return finalOpts.helia; } else {const {createHelia} = await import('helia');const {FsDatastore} = await import('datastore-fs');const {FsBlockstore} = await import('blockstore-fs');const {identify} = await import('@libp2p/identify');const {kadDHT} = await import('@libp2p/kad-dht');const {gossipsub} = await import('@chainsafe/libp2p-gossipsub');return await createHelia({blockstore: new FsBlockstore(repo), datastore: new FsDatastore(repo), libp2p: {services: {dht: kadDHT(), pubsub: gossipsub(), identify: identify()}}});} })()
    // const fileSystem = await (async () => {const {unixfs} = await import('@helia/unixfs');return unixfs(app);})()
    if(!await fse.pathExists(path.join(repo, 'block.txt'))){
      await fs.writeFile(path.join(repo, 'block.txt'), JSON.stringify([]))
    }
    const blockList = block ? JSON.parse((await fs.readFile(path.join(repo, 'block.txt'))).toString('utf-8')) : null

    const current = new Map()

    const handle = (message) => {
        if(current.has(message.detail.topic)){
            const {push} = current.get(message.detail.topic)
            push(message.detail.data)
        }
    }
    app.libp2p.services.pubsub.addEventListener('message', handle)

    async function makePubsub(session){
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
          const obj = {room: new Room(app.libp2p, mainURL.hostname)}
          obj.events = new EventIterator(({ push, fail, stop }) => {
              obj.push = push
              obj.fail = fail
              obj.stop = stop
              function handleFunc(message){
                push(message.data)
              }
              obj.room.on('message', handleFunc)
              // app.libp2p.services.pubsub.subscribe(mainURL.hostname)
              return () => {
                  // app.libp2p.services.pubsub.unsubscribe(mainURL.hostname)
                  obj.room.off('message', handleFunc)
                  obj.room.leave().then(() => {}).catch(console.error)
                  current.delete(mainURL.hostname)
                  // stop()
              }
            })
            current.set(mainURL.hostname, obj)
            return new Response(obj.events, {status: 200})
        }
      } else if(method === 'POST'){
        if(current.has(mainURL.hostname)){
          const test = current.get(mainURL.hostname)
          test.room.broadcast(await toStr(body))
          // await app.libp2p.services.pubsub.publish(mainURL.hostname, new TextEncoder().encode(await toStr(body)))
          return new Response(null, {status: 200})
        } else {
          const obj = {room: new Room(app.libp2p, mainURL.hostname)}
          obj.events = new EventIterator(({ push, fail, stop }) => {
              obj.push = push
              obj.fail = fail
              obj.stop = stop
              function handleFunc(message){
                push(message.data)
              }
              obj.room.on('message', handleFunc)
              // app.libp2p.services.pubsub.subscribe(mainURL.hostname)
              return () => {
                  // app.libp2p.services.pubsub.unsubscribe(mainURL.hostname)
                  obj.room.off('message', handleFunc)
                  obj.room.leave().then(() => {}).catch(console.error)
                  current.delete(mainURL.hostname)
                  // stop()
              }
            })
            current.set(mainURL.hostname, obj)
            obj.room.broadcast(await toStr(body))
            // await app.libp2p.services.pubsub.publish(mainURL.hostname, new TextEncoder().encode(await toStr(body)))
            return new Response(null, {status: 200})
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
        if(error.message === 'PublishError.NoPeersSubscribedToTopic'){
          return new Response(null, {status: 200})
        } else {
          console.error(error)
          return new Response(intoStream(error.stack), {status: 500, headers: mainHeaders})
        }
      }
    }

    async function toStr(data){
      const chunks = []
      for await (let chunk of data) {
        chunks.push(chunk)
      }
      return Buffer.concat(chunks).toString()
    }
  
    async function close(){
        app.libp2p.services.pubsub.removeEventListener('message', handle)
        current.forEach(({stop}) => {stop()})
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

    return {handler: makePubsub, close}
  }