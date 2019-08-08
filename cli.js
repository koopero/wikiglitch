#!/usr/bin/env node
const _ = require('lodash')

go()
function go() {
  var argv = require('minimist')(process.argv.slice(2))
  console.dir(argv);
  let options = argv

  let iter = parseInt( argv['i'] ) || 1
  let instances = _.range( iter )

  Promise.all( _.map( instances, async () => {
    let opt = _.clone( options )
    await require('./lib/main')( opt )
  } ) )
  .then( () => {

  })

}