export default async function makeVeilid (opts = {}) {
    const {hex2arr, arr2hex, arr2text} = await import('uint8-util')
    const path = await import('path')
    const {Readable} = await import('streamx')
    const finalOpts = { timeout: 30000, port: 9990, ...opts }
    const mainPort = finalOpts.port
    const useTimeOut = finalOpts.timeout
    const mainAgent = `http://localhost:${mainPort}`
  
    return async function handleVeil(req) {
      try {
        if(!['HEAD', 'GET', 'POST'].includes(req.method)){
          throw new Error('method must be HEAD, GET, or POST')
        }
      const mainURL = new URL(req.url)
      delete req.url
      const searchParams = mainURL.searchParams
      // req.headers.set('X-id', mainURL.hostname)
      const reqHeaders = req.headers
      if(/^[0-9a-fA-F]+$/.test(mainURL.hostname)){
        req.headers.set('X-id', arr2text(hex2arr(mainURL.hostname)))
      } else if(req.headers.has('x-id') || searchParams.has('x-id')){
        req.headers.set('X-id', req.headers.get('x-id') || searchParams.get('x-id'))
      } else {
        throw new Error('must have x-id header key')
      }
      const useUrl = path.join(mainAgent, mainURL.pathname).replace(/\\/g, '/')


    const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? (() => {const getHead = reqHeaders.get('X-timer');const getSearch = searchParams.get('x-timer');reqHeaders.delete('x-timer');searchParams.delete('x-timer');getHead !== '0' || getSearch !== '0' ? Number(getHead || getSearch) * 1000 : 0})() : useTimeOut

    const session = new Request(useUrl, req)

    const tempRes = mainTimeout ?
    await Promise.race([
      new Promise((resolve, reject) => setTimeout(() => { const err = new Error('timed out'); err.name = 'timeout'; reject(err) }, mainTimeout)),
      fetch(session.url, session)
    ]) :
    await fetch(session.url, session)
    if(!tempRes.headers.forEach){
      tempRes.headers = new Headers(tempRes.headers)
    }

    return new Response(tempRes.body, tempRes)
      } catch (error) {
        return new Response(intoStream(error.stack), {status: 500, statusText: error.message})
      }
    }

    function intoStream (data) {
      return new Readable({
        read () {
          this.push(data)
          this.push(null)
        }
      })
    }
}