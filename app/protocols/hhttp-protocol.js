export default async function makeHTTP(opts){
    const { default: nodeFetch } = await import('node-fetch')
    const DEFAULT_OPTS = {timeout: 30000}
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    const useTimeOut = finalOpts.timeout

    return async function rawFetch(req) {
      const urls = req.url.replace('hhttp', 'http')
      delete req.url
      const session = new Request(urls, req)
      const searchParams = new URL(session.url).searchParams
      const reqHeaders = session.headers
      const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : 0 : useTimeOut
      const tempRes = mainTimeout ?
      await Promise.race([
        new Promise((resolve, reject) => setTimeout(() => { const err = new Error('timed out'); err.name = 'timeout'; reject(err) }, mainTimeout)),
        nodeFetch(session.url, session)
      ]) :
      await nodeFetch(session.url, session)
      return new Response(tempRes.body, {...tempRes})
    }
}