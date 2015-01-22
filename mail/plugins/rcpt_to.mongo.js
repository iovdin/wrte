// rcpt_to.mongo

// documentation via: haraka -c /Users/iovdin/projects/btcmail/mail -h plugins/rcpt_to.mongo

// Put your plugin code here
// type: `haraka -h Plugins` for documentation on how to create a plugin
//
var Address = require('./address').Address;
exports.hook_init_master = function(next) {
    var MongoClient = require('mongodb').MongoClient;
    var config = this.config.get("rcpt_to.mongo.ini", "server");

    this.loginfo("mongo server " + config.main.server);
    //this.loginfo("arguments " + JSON.stringify(arguments));
    var dbURL = config.main.server;
    var inst = this;
    MongoClient.connect(dbURL, function(err, db) {
        if(err) {
            inst.logerror("failed to connect mongodb " + dbURL + " " + JSON.stringify(err));
        }
        server.notes.db = db;
        server.notes.users = db.collection('users');
        next();
    });
}

exports.hook_rcpt = function (next, connection, params) {
    var rcpt = params[0];

    this.loginfo("Got recipient: " + JSON.stringify(params));
    var inst = this;
    if(rcpt.host == 'wrte.io') {
        server.notes.users.findOne({ username : rcpt.user }, { fields : { "emails.address" : 1 } } , 
                function(err, doc) {
                    if(err) return next(DENY, "No such user 1");
                    if(doc && doc.emails[0] && doc.emails[0].address) {
                        var email = doc.emails[0].address;
                        var addr = new Address(email);
                        connection.transaction.header.add("X-Envelope-To", rcpt.user + "@" + rcpt.host);
                        rcpt.host = addr.host;
                        rcpt.user = addr.user;
                        connection.relaying = true;
                        next();
                    } else {
                        return next(DENY, "No such user 2");
                    }
                });
        return;
    } 
    return next(DENY, "No such user");
}
