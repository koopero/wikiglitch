const _ = require('lodash')
const urllib = require('url')
const getHTTP = require('./getHttpCached')
const string2png = require('string2png')
const exec = require('child_process').exec
const Promise = require('bluebird')
const fs = require('fs-extra')
const pathlib = require('path')

async function is_good_file( filename ) {
  try {
    var stat = await fs.stat( pathlib.resolve( filename ) )
  } catch( err ) {
    return false
  }

  if ( stat ) {
    let now = new Date().getTime()
    let age = now - Math.max( stat.ctime.getTime(), stat.mtime.getTime() )

    return true 
    return age < 1000 * 60 * 60 * 24 * 7
  }

  return false
}

async function getAPIQuery( { 
  language = 'en', 
  site = '',
  query = {},
  cache = false,
} ) {

  site = site || `${language}.wikipedia.org`

  query.action = query.action || 'query'
  query.format = 'json'

  query = _.pickBy( query, ( value, key ) => value || value == 0 )

  let url = {
    protocol: 'https:',
    host: site,
    pathname: '/w/api.php',
    query
  }

  url = urllib.format( url )

  return getHTTP( { url, cache } )
}

async function getPageRevisions( { language, title } ) {
  let revisions = []

  let rvprop = 'timestamp|ids|size'
  let rvlimit = 100

  let rvcontinue
  do {
    let result = await getAPIQuery( { language, query: {
      prop: 'revisions',
      titles: title,
      rvprop, rvlimit, rvcontinue
    }})


    _.map( _.get(result,'query.pages'), page => {
      // console.log( page )
      let data = page.revisions

      if ( Array.isArray( data ) )
        revisions = revisions.concat( data )
    } )

    rvcontinue = _.get(result,'continue.rvcontinue')
  } while( rvcontinue )


  _.map( revisions, rev => { rev.language = language; rev.title = title } )

  return revisions
}

async function title_translations( { language, title } ) {
  let translations = {}

  let llprop = 'url|langname|autonym'
  let lllimit = 100

  let llcontinue
  do {
    let result = await getAPIQuery( { language, query: {
      prop: 'langlinks',
      titles: title,
      llprop, lllimit, llcontinue
    }})
    _.map( _.get(result,'query.pages'), page => {
      _.map( page.langlinks, lang => {
        if ( lang['*'] ) 
          translations[lang.lang] = lang['*']

      } )
    } )

    llcontinue = _.get(result,'continue.llcontinue')
  } while( llcontinue )

  return translations
}

async function translate_title( { language, title_language, title } ) {
  if ( language == title_language )
    return { language, title }

  const translations = await title_translations( { language: title_language, title } ) 

  if ( !language ) 
    language = _.sample( _.keys( translations ) )
  
  console.dir( { translations } )
  return { language, title: translations[ language ] }
}



function trimFrames( { frames, length = 100 } ) {
  function frameTime( frame ) {
    if ( frame ) 
      return new Date( frame.timestamp ).getTime()
    
    return new Date().getTime()
  }

  function framesSearch( time ) {
    let frame 

    for( let index = 0; index < frames.length; index ++ ) {
      let next = frameTime( frames[index] )
      if ( next > time )
        return frame

      frame = frames[index]
    }

    return frame
  }

  frames = _.sortBy( frames, frameTime ) 
  let mintime = frames.reduce( ( prev, cur ) => Math.min( prev, frameTime( cur ) ), Infinity )
  let maxtime = frames.reduce( ( prev, cur ) => Math.max( prev, frameTime( cur ) ), -Infinity )

  let deltamax = ( maxtime - mintime ) / length
  let result = []
  let delta = Infinity

  for ( let index = 0; index < length; index ++ ) {
    let time = (( index / ( length - 1 ) ) || 0 ) * ( maxtime - mintime ) + mintime
    result[index] = framesSearch( time )
  }

  result = _.filter( result )

  return result
}

const cheerio = require('cheerio')

async function getFrameData( { 
  frame,
  site = '',
} ) {
  let { title, language } = frame
  site = site || `${language}.wikipedia.org`

  query = {
    title,
    oldid: frame.revid
  }

  let url = {
    protocol: 'https:',
    host: site,
    pathname: '/w/index.php',
    query
  }

  url = urllib.format( url )

  let result = await getHTTP( { url, json: false } )
  let $ = cheerio.load( result )

  result = $('#mw-content-text').text()
  // process.exit()
  return result
}

async function getRandomTitle( { title_language = 'en', rnnamespace = 0 } ) {
  let query = {
    list: 'random',
    rnnamespace,
    rnlimit: 1,
  }
  let result = await getAPIQuery( { language: title_language, query, cache: false } )
  return _.get( result, 'query.random[0].title')
}

function munge( str ) {
  str = str.replace(/[\s\(\)\'\']/g,'')
  return str
}


module.exports = async function main( {
  title = '',
  title_language = 'en',
  language = '',
  rate = 30,
  duration = 1,
  format = 'gif',
  size = 640,
  tint = 100,
  image_transform = '-interpolate Nearest -filter Point ',
  video_transform = '',
  keep_pngs = false,
  skip = false,
} ) {
  let orig_title
  let tries = 1 
  do {
    title = title || await getRandomTitle( { title_language } )
    orig_title = title
    let translation = await translate_title( { title, title_language, language } )
    console.dir( { title, language, translation } )
    title = translation.title
    language = translation.language
  } while( tries-- && !title )

  let length = Math.round( duration * rate )
  let title_hash = munge( title == orig_title ? title : orig_title+'_'+title )
  let prefix = `${length}_${language}_${title_hash}`
  let ffInput = `frame/${prefix}_%05d.png`
  let wildcard = `frame/${prefix}_?????.png`

  let ffOutput = `${prefix}.${format}`

  if ( skip && await is_good_file( ffOutput ) )
    return

  let frames =  await getPageRevisions( { language, title } )


  let hue = Math.PI * 2 * Math.random()
  let third = Math.PI * 2 / 3
  let sat = 60
  let mid = 70
  let colour = [
    mid + sat * Math.sin( hue + third * 0 ),
    mid + sat * Math.sin( hue + third * 1 ),
    mid + sat * Math.sin( hue + third * 2 )
  ]
  colour = colour.map( v => Math.round( v ) ).join(',')
  let image_tint = `-fill "rgb(${colour})" -tint ${tint}`

  frames = trimFrames( { frames, length } )

  frames = await Promise.mapSeries( frames, async(frame,index) => build_frame( { frame, index } ) ,{ concurrency: 4 } )

  await compileSequence( { prefix, frames })

  if ( !keep_pngs ) {
    let clean = `rm -f ${wildcard}`
    await Promise.fromCallback( cb => exec( clean, { shell: true, cwd: pathlib.resolve('.') }, cb ) )
  }

  return

  async function build_frame( { frame, index } ) {
    let data = await getFrameData( { frame } )
    let output = `frame/${prefix}_${ String(index).padStart( 5, '0' ) }.png`

    let can_skip = await is_good_file( output )
    if ( can_skip && skip )
      return frame

    data = data || ''
    data += '00'
    
    let result = await string2png( {
      data,
      square: true,
      encoding: 'ascii',
      background: 'white',
      channels: 'v',
      output,
      // normalize: 1
    } )
  
    let scale = `${size}x${size}\\!`
    let enlarge = `mogrify ${image_transform} ${image_tint} -resize ${ scale } ${ output }`
    let execOpt = {
      shell: true,
    }
    await Promise.fromCallback( cb => exec( enlarge, execOpt, cb ) )
    console.warn( `frame ${output}`)
  }

  async function compileSequence( { prefix, frames } ) {
    let compile = `ffmpeg -y -framerate ${rate} -i ${ ffInput } ${ video_transform } ${ ffOutput }`
    await Promise.fromCallback( cb => exec( compile, { shell: true }, cb ) )
  }
  
}