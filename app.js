
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path')
  , log4js = require('log4js');

log4js.configure({
  appenders: [{
    'type' : 'dateFile',
    'filename': __dirname + '/logs/access.log',
    'pattern': '-yyyy-MM-dd'
  }]
});
var logger = log4js.getLogger('dateFile');

var accesslog = function() {
  return function(req, res, next) {
    logger.info([
      req.headers['x-forwarded-for'] || req.client.remoteAddress,
      new Date().toLocaleString(),
      req.method,
      req.url,
      req.statusCode,
      req.headers.referer || '-',
      req.headers['user-agent'] || '-'
    ].join('\t'));
    next();
  }
};

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(accesslog());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// route
app.get('/', routes.index);
app.get('/builds/:project', routes.builds);
app.get('/apps/:project/:build', routes.apps);
app.get('/plist/:project/:build/:app', routes.plist);
app.get('/apk/:project/:build/:app', routes.apk);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
