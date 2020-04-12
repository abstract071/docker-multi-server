const express = require( 'express' )
const bodyParser = require( 'body-parser' )
const cors = require( 'cors' )
const { Pool } = require( 'pg' )
const redis = require( 'redis' )

const keys = require( './keys' )

const app = express()
app.use( cors() )
app.use( bodyParser.json() )

const pgClent = new Pool( {
  host: keys.pgHost,
  port: keys.pgPort,
  database: keys.pgDatabase,
  user: keys.pgUser,
  password: keys.pgPassword
} )
pgClent.on( 'error', () => console.log( 'Lost PG connection...' ) )

pgClent.query( 'CREATE TABLE IF NOT EXISTS values (number INT)' )
  .catch( err => console.log( err ) )

const redisClient = redis.createClient( {
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
} )

const redisPublisher = redisClient.duplicate()

app.get( '/', ( req, res ) => res.send( 'Hi' ) )

app.get( '/values/all', async ( req, res ) => {
  const values = await pgClent.query( 'SELECT * FROM values' )

  return res.send( values.rows )
} )

app.get( '/values/current', async ( req, res ) => {
  const values = await redisClient.hgetall( 'values', ( err, values ) => {
    return res.send( values )
  } )
} )

app.post( '/values', ( req, res ) => {
  const { index } = req.body

  if ( parseInt( index ) > 40 ) {
    return res.status( 422 ).send( 'Index too high' )
  }

  redisClient.hset( 'values', index, 'Nothing yet!' )
  redisPublisher.publish( 'insert', index )
  pgClent.query( 'INSERT INTO values(number) VALUES($1)', [index] )

  return res.send( { working: true } )
} )

app.listen( 5000, err => console.log( 'Listening' ) )
