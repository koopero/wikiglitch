module.exports = megahash

const _ = require('lodash')
const crypto = require('crypto')

function megahash( input, options ) {
  const hash = crypto.createHash('sha256')
  const update = hash.update.bind( hash )

  hashAnything( input )
  
  let encoding = 'hex'
  let length = 16
  let result = hash.digest( encoding )
  result = result.substr( 0, length )
  return result

  function hashAnything( ob ) {
    if ( _.isArray( ob ) )
      return hashArray( ob ) 

    if ( _.isObject( ob ) )
      return hashObject( ob )

    return hashPrimitive( ob )
  }

  function hashObject( ob ) {
    update('Object:')
    let keys = _.keys( ob )
    keys.sort()
    _.map( keys, key => {
      update('Key:'+key)
      hashAnything( ob[key] )
    } )
  }

  function hashArray( ob ) {
    update('Array:')
    _.map( ob, (val,index) => {
      update( String( index ) )
      hashAnything( val )
    })
  }

  function hashPrimitive( ob ) {
    ob = String( ob )
    update( ob )
  }

}