// rcpt_to.mongo

// documentation via: haraka -c /Users/iovdin/projects/btcmail/mail -h plugins/rcpt_to.mongo

// Put your plugin code here
// type: `haraka -h Plugins` for documentation on how to create a plugin
//
var Address = require('./address').Address;
var DSN = require('./dsn');

exports.register = function() {
    this.register_hook('rcpt', 'wrte_sent_by_myself');
    this.register_hook('rcpt', 'wrte_user_exists');
};
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
        //server.notes.messages = db.collection('messages');
        next();
    });
}

exports.wrte_sent_by_myself = function (next, connection, params) {
    var rcpt = params[0];

    var plugin = this;
    var me = plugin.config.get('me');
    //allow web server and mail server to send messages
    if(connection.remote_ip == "127.0.0.1" ){
        this.loginfo("remote_ip == 127.0.0.1, (from web server or myself?), allow relay");

        if(rcpt.host != me) {
            connection.relaying = true;
            return next(OK);
        }

        if(rcpt.user == "noreply") {
            return next(DENY, DSN.no_such_user()) 
        }


        return next(OK);
    }

    if(rcpt.user == "support" && rcpt.host == me) {
        rcpt.user = "iovdin";
        rcpt.host = "gmail.com";
        connection.relaying = true;
        return next(OK);
    }

    next();
}
exports.wrte_user_exists = function (next, connection, params) {
    var rcpt = params[0];

    //this.loginfo("Got recipient: " + JSON.stringify(params));
    var plugin = this;
    var me = plugin.config.get('me');

    
    if(rcpt.host != me) {
        return next(DENY, DSN.no_such_user())
    }
    server.notes.users.findOne({ username : rcpt.user }, { fields : { "emails.address" : 1, price : 1 } } , function(err, user) {
        if(err) {
            plugin.lognotice("error looking up user " + JSON.stringify(err));
            return next(DENY, DSN.no_such_user())
        }
        if (user && user.emails[0] && user.emails[0].address) {
            var notes = connection.transaction.notes;
            var forwardEmail = new Address(user.emails[0].address);
            rcpt.user = forwardEmail.user; 
            rcpt.host = forwardEmail.host; 
            notes.user = user;
            connection.relaying = true;
            return next();
        } 

        return next(DENY, DSN.no_such_user());
    });
}

