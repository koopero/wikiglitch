const main = require('./lib/main')


const languages = [
  'en',
  // 'pt',
  // 'fr',
  // 'tr',
  'zh',
  // 'vi',
  // 'hak',
  // 'tl',
  '','','','',
  '','','','',
  '','','','',
  '','','','',
]

const titles = [ 
  // 'Coca-Cola',
  // 'Pokémon',
  // 'Water',
  // 'Canada',
  // 'SpaceX',
  // 'Brainfuck',
  // 'Vancouver',
  // 'Calmness',
  // 'Holiday',
  // 'China',
  // 'Jesus',
  // 'Notre-Dame_de_Paris',
  'Newtown,_Connecticut',
  '','','','',
  '','','','',
  '','','','',
  '','','','',
]
const options = {
  skip: true,
  rate: 30,
  duration: 2,
  format: 'gif',
}

let jobs = []

for( let language of languages ) {
  for( let title of titles ) {
    jobs.push( Object.assign( { language, title }, options ) )
  }
}

const _ = require('lodash')

jobs = _.sortBy( jobs, () => Math.random() )

const Promise = require('bluebird')
Promise.map( jobs, job => main( job ), { concurrency: 1 }  )
.then( () => process.exit() )