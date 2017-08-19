const Gamedig = require('gamedig')

const {Database, Model} = require('mongorito')
const db = new Database('localhost/ServerStats')
class Server extends Model {}
class Player extends Model {}
Server.embeds('onlinePlayers', Player)
db.register(Server)
db.register(Player)

const servers = ['my.elkia.life']

async function doStuff (host) {
  // query the server
  let queryOptions = {
    type: 'minecraft',
    host: host
  }
  const queryResponse = await Gamedig.query(queryOptions)

  // database stuff
  let server = await Server.findOne({host: host})
  server = server === null ? new Server({ host }) : server // if there's no database entry, create a new one
   //  .catch(() => {
   //    server.status = false // server is offline
   //  })
  server.set({
    'version': queryResponse.raw.version,
    'onlinePlayers': queryResponse.players.map(name => {
      return ({'ign': name, 'lasseen': new Date()})
    })
  })

  await server.save()
}

db.connect().then(() => {
  // run trough the list of servers and log stuff
  servers.forEach((server) => {
    doStuff(server).then(console.log(`Updated data for '${server}'`))
  })
}).catch(err => console.log(err))
