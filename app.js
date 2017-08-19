const Gamedig = require('gamedig')

const {Database, Model} = require('mongorito')
const db = new Database('localhost/ServerStats')
class Server extends Model {}
class Player extends Model {}
db.register(Server)
db.register(Player)

const servers = ['my.elkia.life']

async function checkServer (host) {
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
        server.set({'status': false})
      })
      // process the data
      .then(queryResponse => {
        server.set({
          'version': queryResponse.raw.version,
          'status': true
        })

        queryResponse.players.map(ign => ign.name).forEach(async ign => {
          let player = await Player.findOne({ign})
          player = player === null ? new Player({ign, added: new Date()}) : player // if there's no database entry, create a new one
          player.set({
            lastSeen: {
              host,
              time: new Date()
            }
          })
          await player.save().then(console.log(`Updated ${player.get('ign')}`))
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
