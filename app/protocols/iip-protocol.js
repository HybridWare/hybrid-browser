const fetchToHandler = require('./fetch-to-handler')

module.exports = async function createHandler (options, session) {
  const makeFetch = require('garlic-fetch')

  const fetch = await makeFetch(options)

  return fetchToHandler(fetch, session)
}
