export default async function makeGemini(opts = {}) {
    const geminiReq = await import('@derhuerst/gemini/client.js')
    const { Readable } = await import('stream')
    
    const DEFAULT_OPTS = {
      timeout: 30000
    }
    
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    const useTimeOut = finalOpts.timeout
    
    function intoStream (data) {
      return new Readable({
        read () {
          this.push(data)
          this.push(null)
        }
      })
    }
    
    async function makeQuery(link, ext) {
      return await new Promise((resolve, reject) => {
          geminiReq(link, ext, (err, res) => {
            if (err) {
              reject(err)
            } else {
              const { statusCode, statusMessage: statusText, meta } = res
  
          const isOK = (statusCode >= 10) && (statusCode < 300)
  
          const headers = isOK ? { 'Content-Type': meta } : {}
  
          const data = isOK ? res : intoStream(meta)
  
              resolve({
                status: statusCode * 10,
                statusText,
                headers,
                body: data
              })
            }
          })
      })
    }
  
    return async function useThefetch(session){
      // const session = new Request(url, opt)
      const toRequest = new URL(url, session.referrer)
      const reqHeaders = new Headers(session.headers)
      const searchParams = toRequest.searchParams

      if (!toRequest.hostname.startsWith('gemini.')) {
        toRequest.hostname = 'gemini.' + toRequest.hostname
      }

      const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : 0 : useTimeOut
  
      const mainExt = reqHeaders.has('x-ext') || searchParams.has('x-ext') ? JSON.parse(reqHeaders.get('x-ext') || searchParams.get('x-ext')) : {}
  
      const tempRes = mainTimeout ?
      await Promise.race([
        new Promise((resolve, reject) => setTimeout(() => { const err = new Error('timed out'); err.name = 'timeout'; reject(err) }, mainTimeout)),
        makeQuery(toRequest.href, mainExt)
      ]) :
      await makeQuery(toRequest.href, mainExt)

      return new Response(tempRes.body, {...tempRes})
    }
  }