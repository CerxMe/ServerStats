const Gamedig = require('gamedig')

const dateFormat = require('dateformat')

const {Database, Model} = require('mongorito')
const db = new Database('localhost/ServerStats')

class Server extends Model {
}

class Player extends Model {
}

db.register(Server)
db.register(Player)

const servers = ['my.elkia.life', 'penguin.elkia.cz']

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
  // if there's an error, set the server status to offline
      .catch(() => {
        // query failed, server is offline
        server.set('status', false)
      })
      // process the data
      .then(queryResponse => {
        // Update server data
        server.set('version', queryResponse.raw.version)
        server.set('status', true)

        // Update players
        let activehour = `activity.${dateFormat(now, 'dddd')}.${now.getHours()}`

        queryResponse.players.map(ign => ign.name).forEach(async ign => {
          let player = await Player.findOne({ign})
          player = player === null ? new Player({ign, 'joined': now}) : player // if there's no database entry, create a new one

          player.get('lastseen').forEach(place => {
            console.log(place)
          })
          // I've tried the .increment() method, did't really work, so this is easier I guess
          player.set(activehour, player.get(activehour) === undefined ? 1 : player.get(activehour) + 1)
          await player.save()
        })
      })

  await server.save()
}

db.connect().then(() => {
  // run trough the list of servers and log stuff
  servers.forEach((server) => {
    checkServer(server).then(console.log(`Updated data for '${server}'`))
  })
}).catch(err => console.log(err))
