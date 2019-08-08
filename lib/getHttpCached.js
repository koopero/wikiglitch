module.exports = getHttpCached
const _ = require('lodash')
const urllib = require('url')
const request = require('request-promise')
const pathlib = require('path')
const megahash = require('./megahash')
const fs = require('fs-extra')

const __cache = {}

async function getHttpCached( { 
  url,
  json = true,
  tmp = pathlib.resolve(__dirname, '..', 'tmp', 'cache'),
  cache = true,
} ) {

  if ( 'object' != typeof url )
    url = urllib.parse( url )

  let { path, host } = url
  path = _.trim( path, '/' )
  path = path.replace( /[\?\&\/\\\.\%]/g, '_' )
  hash = megahash( url, { length: 4 } )
  hash = pathlib.join( host, path.substr(0,100) )+'_'+hash

  filename = pathlib.resolve( tmp, hash )

  let data 

  if ( __cache[hash] && cache ) {
    data = await __cache[hash].data
  }

  if ( _.isUndefined( data ) && cache ) {
    // From file
    try {
      var stat = await fs.stat( filename )
    } catch( err ) {}

    if ( stat ) {
      let now = new Date().getTime()
      let age = now - Math.max( stat.ctime.getTime(), stat.mtime.getTime() )
      let will_read_file = age < 1000 * 60 * 60 * 24 * 7

      if ( will_read_file ) {
        let promise = fs.readFile( filename )
        __cache[hash] = { data: promise, time: now }
        data = await promise
      }
    }
  }

  if ( _.isUndefined( data ) ) {
    // Get from web
    console.warn('get', urllib.format( url ) )
    data = await request( { url } )

    // Save file
    let dir = pathlib.dirname( filename )
    await fs.ensureDir( dir )
    await fs.outputFile( filename, data )
  }

  // Post process
  if ( Buffer.isBuffer( data ) )
    data = data.toString('utf8')

  if ( json ) {
    data = JSON.parse( data )
  }

  return data
}

