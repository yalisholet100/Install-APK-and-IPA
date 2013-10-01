
/*
 * GET home page.
 */
var exec = require('child_process').exec
  , spawn = require('child_process').spawn
  , fs = require('fs')
  , xml2js = require('xml2js')
  , parser = new xml2js.Parser()
  , moment = require('moment');

var projects = [
  "Jenkins Project for iOS 1",
  "Jenkins Project for iOS 2",
  "Jenkins Project for Android 1",
  "Jenkins Project for Android 2",
];

var node_prefix    = process.env.NODE_PREFIX ? process.env.NODE_PREFIX : "";
var node_host      = process.env.NODE_HOSTNAME ? process.env.NODE_HOSTNAME : "localhost" + process.env.PORT | 3000;
var jenkins_host   = process.env.JENKINS_HOST ? process.env.JENKINS_HOST : "localhost:8080";
var jenkins_prefix = process.env.JENKINS_PREFIX ? process.env.JENKINS_PREFIX : "";
var jenkins_dir    = process.env.JENKINS_DIR ? proecess.env.JENKINS_DIR : "/Users/jenkins/.jenkins";

// Show index.html
exports.index = function(req, res){
  console.log("PREFIX:" + node_prefix);
  res.render('index', { title: 'Install IPA & APK', projects: projects, prefix:node_prefix, host:node_host});
};

// Get a list of build numbers
exports.builds = function(req, res) {
  var dir = jenkins_dir + "/jobs/" + req.params.project.replace(/ /g, "\\ ");
  var cmd = 'ls -F ' + dir + '/builds';
  exec(cmd, function(err, stdout, stderr) {
    if(err === null) {
      // Filter build numbers
      var builds = stdout.split('\n').filter(function(item){return item.match(/@/)}).map(function(item){return item.replace(/@/, '')}).sort(function(a,b){return b-a});
      // return the list
      res.writeHead(200, {'Content-Type':'application/json'});
      res.write('{"builds":' + JSON.stringify(builds) + '}');
      res.end();
    } else {
      console.log(err);
      res.send(503);
    }
  });
};

// Get a list of applications by a build number
exports.apps = function(req, res) {
  var dir = jenkins_dir + "/jobs/" + req.params.project.replace(/ /g, "\\ ") + '/builds/' + req.params.build + '/archive';
  var cmd = 'ls -R ' + dir + '| awk \'/:$/&&f{s=$0;f=0} /:$/&&!f{sub(/:$/,"");s=$0;f=1;next} NF&&f{ print s"/"$0 }\''; 
  exec(cmd, function(err, stdout, stderr) {
    if(err === null) {
      // Filter data by .apk or .ipa
      var apps = stdout.split('\n').filter(function(item){return item.match(/\.ipa/) || item.match(/\.apk/)}).map(function(item){return item.substring(item.lastIndexOf('/') + 1)});
      dir = jenkins_dir + "/jobs/" + req.params.project + '/builds/' + req.params.build + '/build.xml';
      fs.readFile(dir, function(err, data) {
        if(err === null) {
          // Get build result and timestamp
          parser.parseString(data, function(err, result) {
            var timestamp = moment(parseInt(result.build.startTime[0]));
            res.writeHead(200, {'Content-Type':'application/json'});
            res.write('{"apps":' + JSON.stringify(apps) + ',"os":"' + os + '","status":"' + result.build.result + '","timestamp":"' + timestamp.format("YYYY/MM/DD HH:mm:ss") + '"}');
            res.end();
          });
        } else {
          console.log(err);
          res.send(503);
        }
      });
    } else {
      console.log(err);
      res.send(503);
    }
  });
};

// Get plist
exports.plist = function(req, res) {
  var dir = jenkins_dir + "/jobs/" + req.params.project.replace(/ /g, "\\ ") + '/builds/' + req.params.build + '/archive';
  var cmd = 'ls -R ' + dir + '| awk \'/:$/&&f{s=$0;f=0} /:$/&&!f{sub(/:$/,"");s=$0;f=1;next} NF&&f{ print s"/"$0 }\'';
  exec(cmd, function(err, stdout, stderr) {
    if(err === null) {
      var app = stdout.split('\n').filter(function(item){return item.indexOf(req.params.app.substring(0, req.params.app.lastIndexOf('.'))) > -1})[0];
      if(req.params.project === "Resign") {
        app = dir + '/' + app;
      }
      // Unzip .ipa file
      cmd = 'unzip -o "' + app + '" -d "' + __dirname + '"';
      var unzip = spawn('unzip', ['-o', app, '-d', __dirname]);
      var stdout = "", stderr = "";
      unzip.stdout.setEncoding('utf8');
      unzip.stdout.on('data', function(data) {
        stdout += data;
      });
      unzip.stderr.setEncoding('utf8');
      unzip.stderr.on('data', function(data) {
        stderr += data;
      });
      unzip.on('close', function(code) {
        if(code === 0) {
          // Get CFBundleName and CFBundleIdentifier
          var plist = stdout.split('\n').filter(function(item){return item.indexOf("Info.plist") > -1})[0];
          var plist = plist.substring(plist.indexOf('/'), plist.length - 2);
          cmd  = '/usr/libexec/PlistBuddy -c "Print :CFBundleDisplayName" "' + plist + '" && ';
          cmd += '/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "' + plist + '"';
          exec(cmd, function(err, stdout, stderr) {
            if(err === null) {
              stdout = stdout.split('\n');
              var title = stdout[0];
              var bundle = stdout[1];
              var url = 'http://' + jenkins_host + '/' + jenkins_prefix + '/job/' + encodeURIComponent(req.params.project) + '/' + req.params.build + '/artifact/' + encodeURIComponent(app.substring(app.indexOf('archive') + 8)).replace(/%2F/g, "/");
              res.writeHead(200, {
                "Accept-Ranges" : "bytes",
                "Content-Disposition": "attachment; filename=\"" + req.params.app + "\"",
                "Content-Type": "text/xml",
              });
              // Create Plist file
              res.write('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n');
              res.write('<plist version="1.0">\n<dict>\n  <key>items</key>\n  <array>\n    <dict>\n      <key>assets</key>\n      <array>\n');
              res.write('        <dict>\n          <key>kind</key>\n          <string>software-package</string>\n');
              res.write('          <key>url</key>\n          <string>' + url + '</string>\n');
              res.write('        </dict>\n      </array>\n      <key>metadata</key>\n      <dict>\n        <key>bundle-identifier</key>\n');
              res.write('        <string>' + bundle + '</string>\n');
              res.write('        <key>kind</key>\n        <string>software</string>\n        <key>title</key>\n');
              res.write('        <string>' + title + '</string>\n');
              res.write('      </dict>\n    </dict>\n  </array>\n</dict>\n</plist>\n');
              res.end();
            } else {
              console.log(err);
              res.send(503);
            }
          });
        } else {
          console.log(stderr);
          res.send(503);
        }
      });
    } else {
      console.log(err);
      res.send(503);
    }
  });
};

exports.apk = function(req, res) {
  var dir = jenkins_dir + "/jobs/" + req.params.project.replace(/ /g, "\\ ") + '/builds/' + req.params.build + '/archive';
  var cmd = 'ls -R ' + dir + '| awk \'/:$/&&f{s=$0;f=0} /:$/&&!f{sub(/:$/,"");s=$0;f=1;next} NF&&f{ print s"/"$0 }\'';
  exec(cmd, function(err, stdout, stderr) {
    if(err === null) {
      var app = stdout.split('\n').filter(function(item){return item.indexOf(req.params.app.substring(0, req.params.app.lastIndexOf('.'))) > -1})[0];
      var url = 'http://' + jenkins_host + '/' + jenkins_prefix + '/job/' + encodeURIComponent(req.params.project) + '/' + req.params.build + '/artifact/' + encodeURIComponent(app.substring(app.indexOf('archive') + 8)).replace(/%2F/g, "/");
      res.writeHead(302, {'Location' : url});
      res.end();
    } else {
      console.log(err);
      res.send(503);
    }
  });
};
