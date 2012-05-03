// Copyright Teleportd Ltd
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util');
var crypto = require('crypto');
var http = require('http');
var qs = require('querystring');
var buf = require('buffer');
var events = require('events');
var fwk = require('fwk');

/**
 * Dynamic Parser Object borrowed to twitter-node
 */
var Parser = function Parser() {    
  events.EventEmitter.call(this);
  this.buffer = '';
  return this;
};

// The parser emits events!
Parser.prototype = Object.create(events.EventEmitter.prototype);
Parser.END        = '\r\n';
Parser.END_LENGTH = 2;

Parser.prototype.receive = function receive(buffer) {    
  this.buffer += buffer.toString('utf8');
  var index, json;    
  // We have END?
  while ((index = this.buffer.indexOf(Parser.END)) > -1) {
    json = this.buffer.slice(0, index);
    this.buffer = this.buffer.slice(index + Parser.END_LENGTH);
    if (json.length > 0) {    
      try {
        json = JSON.parse(json);
        this.emit('object', json);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }
};


/**
 * Teleportd API Wrapper Object
 * 
 * @extends {}
 * 
 * @param spec {user_key}
 */
var teleportd = function(spec, my) {
  my = my || {};
  var _super = {};

  my.streams = {};
  my.nextsid = 1;  

  my.user_key = spec.user_key || null;

  // /!\ Internal use only
  my.host = spec.host || 'api.teleportd.com';
  my.access_key = spec.access_key || null;
  
  // public
  var search; /* search({loc, str, period, from, size}, function(err, hits, total, took) {...}); */
  var stream; /* stream({loc, str}, function(pic) {...}); */
  var stop;   /* stop(sid); */
  var get;    /* get(sha, function(err, pic) {...}); */
  var batch;  /* batch(shas, function(err, pics) {...}); */

  // Internal
  var tag;    /* tag(sha, tags, function(err) {...}); */

  // private
  var build;

  var that = {};

  /**
   * builds the get query
   * @param spec search spec
   * @return options 
   */
  build = function(spec, endpoint) {
    var headers = {'User-Agent': 'NodeJS Teleportd API Driver v0.1.0'};
    
    var q = { accesskey: my.access_key,
              user_key: my.user_key };
    // parameters validation
    if(Array.isArray(spec.loc) && spec.loc.length === 4)       // loc     [stream|search]
      q.loc = JSON.stringify(spec.loc);
    if(typeof spec.str === 'string')                           // str     [stream|search]
      q.str = spec.str;
    if(Array.isArray(spec.period) && spec.period.length === 2) // period  [search]
      q.period = JSON.stringify(spec.period);
    if(typeof spec.from === 'number')                          // from    [search]
      q.from = spec.from;
    if(typeof spec.size === 'number')                          // skip    [search]
      q.size = spec.size;
    if(typeof spec.sort === 'string')                          // sort    [serach]
      q.sort = spec.sort;

    if(Array.isArray(spec.track))                              // track   [stream]
      q.track = JSON.stringify(spec.track);

    if(typeof spec.sha === 'string')                           // sha     [get]
      q.sha = spec.sha;
    
    if (Array.isArray(spec.shas))
      q.shas = spec.shas.join(',');
    else if (typeof spec.shas === 'string')
      q.shas = spec.shas;

    var options = { host: my.host,
	    	            port: 80,
	    	            path: '/' + endpoint + '?' + qs.stringify(q),
	    	            headers: headers };

    return options;    
  };

  /**
   * Performs a search and returns the array of pic received
   * @param spec {loc, str, period, from, size}
   * @param cb   callback function cb(err, hits, total, took)
   */
  search = function(spec, cb) {
    if(!Array.isArray(spec.loc) && 
       typeof spec.str !== 'string') {
      cb(new Error('Empty Search not permitted'))
      return;
    }
    http.get(build(spec, 'search'), function(res) {
      res.setEncoding('utf8');
      var body = '';
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        try {
          var res = JSON.parse(body);
          if(res.ok)
            cb(null, res.hits, res.total, res.took);
          else
            cb(new Error('Search fail: ' + res.error));
        }
        catch (e) {
          cb(e);
        }
      });
    }).on('error', function(err) {
      cb(err);
    });
  };
  
  /**
   * Starts a stream search and calls cb on each pic received
   * @param spec {loc, track}
   * @param cb   callback function
   * @return sid stream id
   */
  stream = function(spec, cb, id) {
    var sid = my.nextsid++;       
    if(typeof id !== 'undefined')
      sid = id;      
    if(typeof my.streams[sid] === 'undefined')
      my.streams[sid] = { error: 0,
                          cb: cb };
    
    var restart = function() {
      if(typeof my.streams[sid] !== 'undefined') {        
        if(my.streams[sid].res) {
          my.streams[sid].res.destroy();
          delete my.streams[sid].res;
        }

        my.streams[sid].error++;
        if(my.streams[sid].error > 5)
	        my.streams[sid].error = 5;
        util.debug('STREAM RESTART COUNT: ' + (my.streams[sid].error - 1) + ' ' + (1000 * Math.pow(2, my.streams[sid].error - 1)));
        setTimeout(function() {			      
	  stream(spec, cb, sid);
	}, 1000 * Math.pow(2, my.streams[sid].error - 1));		 
      }
    };	       
    
    http.get(build(spec, 'stream'), function(res) {
      res.setEncoding('utf8');
      var parser = new Parser();

      // to avoid having multiple streams
      if(!my.streams[sid])
        return;
      if(my.streams[sid].res) {
        res.destroy();
        return;
      }

      my.streams[sid].res = res;
      my.streams[sid].parser = parser;      
      
      parser.on('object', function(pic) {
        my.streams[sid].error = 0;
        cb(pic);
      });      
      res.on('data', function(chunk) {
        parser.receive(chunk);
      });

      res.on('end', function() {
        restart();
      });	       
      res.on('error', function(e) {
        restart();
      });
      res.connection.on('close', function(e) {
        restart();
      });
      
    }).on('error', function(e) {
      restart();
    });
    
    return sid;
  };

  /**
   * Stops a stream or all the stream
   * @param sid stream id or null for all streams
   */ 
  stop = function(sid) {
    if(sid && my.streams[sid]) {
      if(my.streams[sid].res)
        my.streams[sid].res.destroy();
      my.streams[sid].cb();
      delete my.streams[sid];
    }
    else if(typeof sid === 'undefined') {
      for(var s in my.streams) {
	      if(my.streams.hasOwnProperty(s)) {
	        my.streams[s].res.destroy();
          my.streams[s].cb();
        }
      }
      my.streams = {};
    }
  };

  /**
   * Retrieves detailed information about a particular pic
   * @param sha 
   * @param cb      callback function cb(err, pic)
   */
  get = function(sha, cb) {
    var spec = {sha: sha};
    http.get(build(spec, 'get'), function(res) {
      res.setEncoding('utf8');
      var body = '';
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        try {
          var res = JSON.parse(body);
          if(res.ok)
            cb(null, res.hit);
          else
            cb(new Error('Get fail: ' + res.error));
        }
        catch(e) {
          cb(e);
        }
      });
    }).on('error', function(err) {
      cb(err);
    });	       
  };
  
  /**
   * Retrieves detailed information about multiple pics
   * @param shas    array containing multiple shas
   * @param cb      callback function cb(err, pics)
   */
  batch = function(shas, cb) {
    var spec = { shas: shas };
    http.get(build(spec, 'batch'), function(res) {
      res.setEncoding('utf8');
      var body = '';
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        try {
          var res = JSON.parse(body);
          if (res.ok) {
            cb(null, res.batch);
          } else {
            cb(new Error('Batch fail: ' + res.error));
          }
        } catch(e) {
          cb(e);
        }
      });
    }).on('error', function(err) {
      cb(err);
    });      
  };

  /**
   * Add specified tag to a pic
   * /!\ For internal use only
   * @param sha
   * @param tags  { tag: [], untag: [] }
   * @param cb    callback function cb(err)
   */
  tag = function(sha, tags, cb) {    
    if(typeof tags === 'undefined' ||
       (!Array.isArray(tags.tag) &&
        !Array.isArray(tags.untag))
       cb(new Error('tags must be passed as { tag: [], untag: [] }'));
       return;
      }         
    var options = { host: 'post.core.teleportd.com',
                    port: 80,
                    path: '/tag/' + sha,
                    method: 'POST',
                    headers: { "content-type": 'application/json',
                               "x-teleportd-accesskey": my.access_key }
                  };
    var body = '';
    
    var req = http.request(options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function() {
        try {
          var post = JSON.parse(body);
          if (post.ok)
            cb();
        }
        catch(e) {
          cb(e);
        }
      });
    });
    
    req.on('error', function(e) {
      cb(e);
    });
    
    req.write(JSON.stringify(tags));
    req.end();
  };



  // exposed methods
  fwk.method(that, 'search', search, _super);
  fwk.method(that, 'stream', stream, _super);
  fwk.method(that, 'stop', stop, _super);
  fwk.method(that, 'get', get, _super);
  fwk.method(that, 'batch', batch, _super);

  // internal use
  fwk.method(that, 'tag', tag, _super);

  return that;
};

exports.teleportd = teleportd;