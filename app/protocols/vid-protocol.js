export default async function makeVeilid (opts = {}) {
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
      req.headers.set('X-Iden', mainURL.hostname)
      const reqHeaders = req.headers
      const useUrl = mainAgent + mainURL.pathname


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