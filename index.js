var dgram = require('dgram')
var crypto = require('crypto')
var DNSPacket = require('native-dns-packet')

var port = 53
var host = '0.0.0.0'
var server = dgram.createSocket('udp4')
var google = dgram.createSocket('udp4')
var records = {
  'hello.xn--e28h': {
    1: {
      1: {
        ttl: 299,
        address: '104.196.159.14'
      }
    }
  },
  'paper.xn--oq8h': {
    1: {
      1: {
        ttl: 299,
        address: '104.196.159.14'
      }
    }
  },
  'smpc.xn--wu8h': {
    1: {
      1: {
        ttl: 299,
        address: '104.196.159.14'
      }
    }
  },
  'billdrew.xn--8k8h': {
    1: {
      1: {
        ttl: 299,
        address: '104.196.159.14'
      }
    }
  }
}
var requests = {}
var message = new Buffer(1024)

server.on('message', (msg, rinfo) => {
  var packet = DNSPacket.parse(msg)
  log('got query', rinfo, packet)

  var question = packet.question[0]
  var record = records[question.name]
  if (record) {
    record = record[question.class]
    if (record) record = record[question.type]
    if (record) {
      packet.answer.push(
        Object.assign({
          name: question.name,
          class: question.class,
          type: question.type
        }, record)
      )
    } else {
      packet.authority.push(
        Object.assign({
          name: question.name,
          class: question.class,
          type: 6,
          ttl: 1799,
          primary: 'dns.smpc.tv',
          admin: 'hostmaster.dns.smpc.tv',
          serial: 2017022000,
          refresh: 43200,
          retry: 3600,
          expiration: 604800,
          minimum: 3601
        }, record)
      )
    }
    packet.header.qr = 1
    packet.header.ra = 1
    var size = DNSPacket.write(message, packet)
    server.send(message, 0, size, rinfo.port, rinfo.address, err => {
      if (err) {
        console.error('response failed', err)
      } else {
        log('response sent', packet)
      }
    })
  } else {
    var rid = crypto.randomBytes(2).readUInt16LE(0)
    requests[rid] = rinfo
    rinfo.originalId = packet.header.id
    packet.header.id = rid
    size = DNSPacket.write(message, packet)
    google.send(message, 0, size, 53, '8.8.8.8', err => {
      if (err) throw err
      log('sent query to google dns', rid)
    })
  }
})

google.on('message', msg => {
  var packet = DNSPacket.parse(msg)
  var id = packet.header.id
  log('got response from google', packet)

  var rinfo = requests[id]
  if (!rinfo) {
    console.error('Unknown request', id)
    return
  } else {
    delete requests[id]
    packet.header.id = rinfo.originalId
    var size = DNSPacket.write(message, packet)
  }

  server.send(message, 0, size, rinfo.port, rinfo.address, err => {
    if (err) {
      console.error('response failed', err)
    } else {
      log('response sent')
    }
  })
})

server.bind(port, host, err => {
  if (err) throw err
  log('udp server listening on', server.address().port)
})

function log () {
  // console.log.apply(console, arguments)
}
