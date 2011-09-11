(function() {
  var DATA_DIR, EventEmitter, LineParser, async, exec, fs, http, lpadded, main, spawn, url, _ref;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  fs = require('fs');
  url = require('url');
  http = require('http');
  EventEmitter = require('events').EventEmitter;
  _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;
  async = require('async');
  DATA_DIR = "" + __dirname + "/temp";
  lpadded = function(n, s) {
    while (s.length < n) {
      s = "0" + s;
    }
    return s;
  };
  LineParser = (function() {
    __extends(LineParser, EventEmitter);
    function LineParser(s) {
      LineParser.__super__.constructor.call(this);
      s.on('data', __bind(function(data) {
        return this.emit('line', data.toString('utf-8'));
      }, this));
    }
    return LineParser;
  })();
  main = function() {
    var counter, server;
    counter = 0;
    server = http.createServer(function(req, res) {
      var callback_url, concurrency, f, lineParser, p, prefix, q, segment_seconds, _ref2;
      if (!req.url.match(/^\/segment_ts/)) {
        res.writeHead(404, {});
        res.end(new Buffer('404'));
        return;
      }
      counter++;
      prefix = "job" + counter;
      _ref2 = url.parse(req.url, true).query || {}, callback_url = _ref2.callback_url, segment_seconds = _ref2.segment_seconds;
      segment_seconds || (segment_seconds = 5);
      console.log('callback_url:', callback_url);
      p = spawn("" + __dirname + "/../live_segmenter/live_segmenter", ["" + segment_seconds, DATA_DIR, prefix, "foo"]);
      req.pipe(p.stdin);
      lineParser = new LineParser(p.stderr);
      f = function(task, callback) {
        var cb_opt, cb_req, hostname, pathname, port, search, _ref3;
        console.log('POSTing new segment:', JSON.stringify(task));
        _ref3 = url.parse(callback_url), hostname = _ref3.hostname, port = _ref3.port, pathname = _ref3.pathname, search = _ref3.search;
        cb_opt = {
          method: 'POST',
          host: hostname,
          port: port || 80,
          path: pathname + (search || "")
        };
        cb_req = http.request(cb_opt, function(res) {
          return callback();
        });
        return fs.createReadStream(task.path).pipe(cb_req);
      };
      concurrency = 1;
      q = async.queue(f, concurrency);
      return lineParser.on('line', function(line) {
        var digits, m, task;
        if (m = line.match(/segmenter: ([0-9]+), ([0-9]+), ([0-9]+),/)) {
          digits = lpadded(5, "" + (parseInt(m[2], 10)));
          task = {
            path: "" + DATA_DIR + "/" + prefix + "-" + digits + ".ts",
            final: !!parseInt(m[3], 10)
          };
          return q.push(task, function(e) {
            if (task.final) {
              res.writeHead(200, {
                'text/javascript': 'text/javascript'
              });
              return res.end(JSON.stringify({}));
            }
          });
        }
      });
    });
    return exec("mkdir -p '" + DATA_DIR + "'", function(e) {
      var port;
      if (e) {
        throw e;
      }
      port = 15473;
      return server.listen(port, function() {
        return console.log("Listening on port " + port + "...");
      });
    });
  };
  process.on('uncauchtException', function(e) {
    return console.log('************* ERROR', e);
  });
  module.exports = {
    main: main
  };
}).call(this);
