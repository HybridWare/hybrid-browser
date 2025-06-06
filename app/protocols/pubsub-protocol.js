export default async function makePubsubFetch (opts = {}) {
  const errLog = opts.err
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

    async function makePubsub(session){
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
          const obj = current.has(mainURL.hostname) ? current.get(mainURL.hostname) : iter(mainURL.hostname)
          if(headers.has('x-iden') && JSON.parse(headers.get('x-iden'))){
            const {room} = obj
            const arr = room.getPeers()
            const rand = arr[Math.floor(Math.random() * arr.length)]
            if(rand){
              return new Response(null, {status: 200, headers: {...mainHeaders, 'X-Iden': rand}})
            } else {
              return new Response(null, {status: 400, headers: mainHeaders})
            }
          } else {
            return new Response(null, {status: 200, headers: mainHeaders})
          }
        } else if(method === 'GET'){
        const obj = current.has(mainURL.hostname) ? current.get(mainURL.hostname) : iter(mainURL.hostname)
        if(headers.has('x-iden') && JSON.parse(headers.get('x-iden'))){
          return new Response(JSON.stringify(obj.room.getPeers()), {status: 200, headers: mainHeaders})
        } else {
          return new Response(obj.events, {status: 200, headers: mainHeaders})
        }
      } else if(method === 'POST'){
        const id = headers.has('x-iden') || search.has('x-iden') ? headers.get('x-iden') || search.get('x-iden') : null
        const obj = current.has(mainURL.hostname) ? current.get(mainURL.hostname) : iter(mainURL.hostname)
        if(id){
          try {
            obj.room.sendTo(id, await toStr(body))
          } catch (error) {
            if(error.message !== 'PublishError.NoPeersSubscribedToTopic'){
              console.error(error)
            }
          }
        } else {
          try {
            await obj.room.broadcast(await toStr(body))
          } catch (error) {
            if(error.message !== 'PublishError.NoPeersSubscribedToTopic'){
              console.error(error)
            }
          }
        }
        return new Response(null, {status: 200, headers: mainHeaders})
      } else if(method === 'DELETE'){
        if(current.has(mainURL.hostname)){
          const test = current.get(mainURL.hostname)
          test.stop()
          current.delete(mainURL.hostname)
          return new Response(mainURL.hostname, {status: 200, headers: mainHeaders})
        } else {
          return new Response(mainURL.hostname, {status: 400, headers: mainHeaders})
        }
      } else {
        return new Response('invalid method', {status: 400, headers: mainHeaders})
      }
      } catch (error) {
        if(error.message === 'PublishError.NoPeersSubscribedToTopic'){
          return new Response(null, {status: 200, headers: mainHeaders})
        } else {
          if(errLog){
            console.error(error)
          }
          return new Response(intoStream(error.stack), {status: 500, headers: mainHeaders})
        }
      }
    }

    function iter(hostname){
      const obj = {room: new Room(app.libp2p, hostname)}
      obj.events = new EventIterator(({ push, fail, stop }) => {
          obj.push = push
          obj.fail = fail
          obj.stop = stop
          function handleFunc(message){
            message.data = new TextDecoder().decode(message.data)
            push(JSON.stringify(message))
          }
          obj.room.on('message', handleFunc)
          // app.libp2p.services.pubsub.subscribe(hostname)
          return () => {
              // app.libp2p.services.pubsub.unsubscribe(hostname)
              obj.room.off('message', handleFunc)
              obj.room.leave().then(() => {}).catch(console.error)
              current.delete(hostname)
              // stop()
          }
        })
        current.set(hostname, obj)
        return obj
    }

    async function toStr(data){
      const chunks = []
      for await (let chunk of data) {
        chunks.push(chunk)
      }
      return Buffer.concat(chunks).toString()
    }
  
    async function close(){
        // app.libp2p.services.pubsub.removeEventListener('message', handle)
        for(const [k, v] of current){
          await v.room.leave()
        }
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