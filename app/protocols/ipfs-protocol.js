const fetchToHandler = require('./fetch-to-handler')

module.exports = async function createHandler (options, session) {
  
  const makeFetch = require('chunk-fetch')

  const fetch = await makeFetch(options)

  async function close(){
    if(fetch.close){
      return await fetch.close()
    } else if(fetch.destroy){
      return await fetch.destroy()
    }
  }
  
  return { handler: fetchToHandler(fetch, session), close, fetch }
}
