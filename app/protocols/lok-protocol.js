export default async function makeLayer (opts = {}) {
    const { default: nodeFetch } = await import('node-fetch')
    // const detect = require('detect-port')
    // const SocksProxyAgent = require('socks-proxy-agent').SocksProxyAgent
    const finalOpts = { timeout: 30000, ...opts }
    // const mainPort = finalOpts.port || 9077
    const useTimeOut = finalOpts.timeout
    // const mainAgent = new SocksProxyAgent(`socks5h://127.0.0.1:${mainPort}`)
  
  // function useAgent(_parsedURL) {
  //   if (_parsedURL.protocol === 'http:' || _parsedURL.protocol === 'https:') {
  //       return mainAgent
  //     } else {
  //       throw new Error('protocol is not valid')
  //     }
  //   }
  
    return async function handleLok(req) {
      const urls = req.url.replace('lok', 'http')
      delete req.url
      const session = new Request(urls, req)
      const mainURL = new URL(session.url)
      const searchParams = mainURL.searchParams
      const reqHeaders = session.headers
  
      if(mainURL.hostname === '_'){
        // const detectedPort = await detect(mainPort)
        // const isItRunning = mainPort !== detectedPort
        // return {status: 200, headers: {'Content-Type': 'text/plain; charset=utf-8'}, body: String(isItRunning)}
        return new Response('running', {status: 200, headers: {'Content-Type': 'text/plain; charset=utf-8'}})
      }
  
      // session.agent = useAgent
      const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : 0 : useTimeOut
      
      const tempRes = mainTimeout ?
      await Promise.race([
        new Promise((resolve, reject) => setTimeout(() => { const err = new Error('timed out'); err.name = 'timeout'; reject(err) }, mainTimeout)),
        nodeFetch(session.url, session)
      ]) :
      await nodeFetch(session.url, session)
      if(!tempRes.headers.forEach){
        tempRes.headers = new Headers(tempRes.headers)
      }

      return new Response(tempRes.body, {...tempRes})
    }
  }