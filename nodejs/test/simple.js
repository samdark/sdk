var util = require('util');

var user_key = 'XXX____YOUR_USER_KEY____XXX';

var tl = require('../lib/teleportd.js').teleportd({ user_key: user_key });

/*
tl.search({ string: 'ford' }, function(hits, total, took) {
  console.log('hits: ' + util.inspect(hits));
  console.log('total: ' + util.inspect(total));
  console.log('took: ' + util.inspect(took));
});

tl.get('12-01-31-fb2fcc847a96681ef9cd61c011a6f93e3d92ef7f', function(pic) {
  console.log(util.inspect(pic));
});
*/

/*
tl.batch(['12-04-24-f4aa9d0aaedb73168b72aa2ab711044e065e05b3',
          '12-04-24-59a5fcada19cebb814de58cdbfe8463a06ad1625',
          '12-04-24-d3fa0db46890225a7e8dfa2abd49a431d3827eaf'],
          function(err, pics) {
            console.log(util.inspect(pics));
          }
);
*/

var sid = tl.stream({ track: ['paris'] }, function(pic) {
  if (typeof pic == 'undefined') {
    util.debug('STREAM: END!');
	} else {
    util.debug('STREAM: ' + util.inspect(pic));
  }
});

/*
setTimeout(function() {
  console.log('TOP!');
    tl.stop(sid);
}, 1000);
*/