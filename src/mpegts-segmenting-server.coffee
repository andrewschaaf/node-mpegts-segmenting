
fs = require 'fs'
url = require 'url'
http = require 'http'
{EventEmitter} = require 'events'
{spawn,exec} = require 'child_process'
async = require 'async'


DATA_DIR = "#{__dirname}/temp"

lpadded = (n, s) ->
  while s.length < n
    s = "0" + s
  s


class LineParser extends EventEmitter
  constructor: (s) ->
    super()
    s.on 'data', (data) =>
      #TODO: actual line parsing e.g. via binary
      @emit 'line', data.toString('utf-8')


main = () ->
  
  counter = 0
  
  server = http.createServer (req, res) ->
    
    if not req.url.match /^\/segment_ts/
      res.writeHead 404, {}
      res.end new Buffer '404'
      return
    
    counter++
    prefix = "job#{counter}"
    {callback_url, segment_seconds} = url.parse(req.url, true).query or {}
    segment_seconds or= 5
    console.log 'callback_url:', callback_url
    
    p = spawn "#{__dirname}/../live_segmenter/live_segmenter", [
          "#{segment_seconds}", DATA_DIR, prefix, "foo"]
    
    req.pipe p.stdin
    lineParser = new LineParser p.stderr
    
    f = (task, callback) ->
      console.log 'POSTing new segment:', JSON.stringify(task)
      {hostname,port,pathname,search} = url.parse(callback_url)
      cb_opt = {
        method: 'POST'
        host: hostname
        port: port or 80
        path: pathname + (search or "")
      }
      cb_req = http.request cb_opt, (res) ->
        callback()
      fs.createReadStream(task.path).pipe cb_req
    
    concurrency = 1
    q = async.queue f, concurrency
    
    lineParser.on 'line', (line) ->
      if m = line.match /segmenter: ([0-9]+), ([0-9]+), ([0-9]+),/
        digits = lpadded 5, "#{parseInt(m[2], 10)}"
        task = {
          path: "#{DATA_DIR}/#{prefix}-#{digits}.ts"
          final: (!! parseInt(m[3], 10))
        }
        q.push task, (e) ->
          if task.final
            res.writeHead 200, {'text/javascript'}
            res.end JSON.stringify {}
  
  exec "mkdir -p '#{DATA_DIR}'", (e) ->
    throw e if e
    port = 15473
    server.listen port, () ->
      console.log "Listening on port #{port}..."


process.on 'uncauchtException', (e) ->
  console.log '************* ERROR', e


module.exports =
  main: main

