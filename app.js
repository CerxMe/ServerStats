const Gamedig = require('gamedig')

const dateFormat = require('dateformat')

// Database stuff
const {Database, Model} = require('mongorito')
const db = new Database('localhost/ServerStats')

class Server extends Model {
}

class Player extends Model {
}

db.register(Server)
db.register(Player)

// Array of IP's to querry
const servers = ['my.elkia.life'] // does not work w/ multiple

// Querry server for data and log those
async function checkServer (host) {
  let now = new Date()

  // database stuff
  let server = await Server.findOne({host})
  server = server === null ? new Server({host}) : server // if there's no database entry, create a new one

  // query the server
  let queryOptions = {
    type: 'minecraft',
    host: host
  }

  await Gamedig.query(queryOptions)
      // process the data
      .then(async queryResponse => {
        // Update server data
        server.set('version', queryResponse.raw.version)
        server.set('status', true)

        server.set('players', queryResponse.players.length)
        // new record
        if (server.get('maxplayers') < queryResponse.players.length) {
          server.set('maxplayers', queryResponse.players.length)
          console.log(`'${host}' : New record! There's more players online (${queryResponse.players.length}) than ever before!`)
        }

        // Update players
        let activehour = `activity.${dateFormat(now, 'dddd')}.${now.getHours()}`
        await queryResponse.players.map(ign => ign.name).forEach(async ign => {
          let player = await Player.findOne({ign})
          console.log(`'${host}' : Updating player '${ign}'`)

          // New player entry if theres not one already.
          player = player === null ? new Player({ign, 'joined': now}) : player

          // Lastseen
          player.set('lastseen', now)

          // Activity
          // I've tried the .increment() method, did't really work, so this is easier I gu ess
          //                                if there's no data     set it to 1    othervise add one to the curent value
          player.set(activehour, player.get(activehour) === undefined ? 1 : player.get(activehour) + 1)

          // Sessions
          let sessions = player.get('sessions')
          if (sessions === undefined) {
            // first session
            player.set('sessions', [{'active': true, host, 'start': now}])
          } else {
            // find any active sessions
            let counter = 0
            let activesession = false
            await sessions.forEach(session => {
              counter++
              if (session.active !== undefined) {
                activesession = true
              }
              if (counter === sessions.length) {
                // if there isnt any active session
                if (activesession === false) {
                    // add a new one
                  player.set('sessions',
                        player.get('sessions').concat([{'active': true, host, 'start': now}])
                    )
                }
              }
            })
          }

          // Save the player info
          await player.save()
        })
      })

      // if there's an error querrying, set the server status to offline
      .catch((err) => {
        console.log(`'${host}' : ${err}`)
        server.set('status', false)
      })
  await server.save()
}

// Terminate sessions
async function sessionTerminator () {
  // get all players
  let players = await Player.find()
  // check them one by one
  await players.forEach(async player => {
    player.set('sessions',
        await player.get('sessions').map(session => {
          // if player has an active session
          if (session.active) {
            // but it has been more than 5 minutes (300000 miliseconds) since he's been lastseen, terminate that session
            if (new Date() - player.get('lastseen') >= 300000) {
              session.active = null
              delete session.active
              session.end = player.get('lastseen')
              console.log(`Terminated session for ${player.get('ign')}`)
            }
          }
        })
    )
    await player.save()
  })
}

// I know I know but this whole callback stuff wasnt really working for me soooo
function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Connect to DB and do the magic
db.connect().then(async () => {
  // run trough the list of servers and log stuff
  await servers.forEach(async (server) => {
    await checkServer(server)
    await sleep(3000)
    await sessionTerminator()
  })
  await sleep(6000)
  db.disconnect()
})
