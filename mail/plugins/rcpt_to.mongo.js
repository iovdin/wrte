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
        server.notes.invoices = db.collection('Invoice');
        server.notes.tests = db.collection('Test');
        //server.notes.messages = db.collection('messages');
        next();
    });
}

exports.wrte_sent_by_myself = function (next, connection, params) {
    var rcpt = params[0];

    var plugin = this;
    var me = plugin.config.get('me');

    if(rcpt.host == me){
        if(rcpt.user == "support") {
            rcpt.user = "iovdin";
            rcpt.host = "gmail.com";
            var addr = new Address("ivanpashenko", "gmail.com");
            addr.original = "support@wrte.io";
            connection.transaction.rcpt_to.push(addr);
            connection.relaying = true;
            return next(OK);
        }
        if( ["abuse", "delivery"].indexOf(rcpt.user) >= 0 ) {
            rcpt.user = "iovdin";
            rcpt.host = "gmail.com";
            connection.relaying = true;
            return next(OK);
        }
        var reserved = ["noreply"];
        if(reserved.indexOf(rcpt.user) >= 0) {
            return next(DENY, DSN.no_such_user()) 
        }
        return next();
    }

    //allow web server and mail server to send messages
    if(connection.remote_ip == "127.0.0.1" ){
        this.loginfo("remote_ip == 127.0.0.1, (from web server or myself?), allow relay");
        if(rcpt.host != me) {
            connection.relaying = true;
        }

        return next(OK);
    }
    return next(DENY, DSN.relaying_denied()) 
}
exports.wrte_user_exists = function (next, connection, params) {
    var rcpt = params[0];

    //this.loginfo("Got recipient: " + JSON.stringify(params));
    var plugin = this;
    var me = plugin.config.get('me');

    
    if(rcpt.host != me) {
        return next(DENY, DSN.no_such_user())
    }
    server.notes.users.findOne({ username : rcpt.user }, { fields : { username : 1, "emails.address" : 1, price : 1 } } , function(err, user) {
        if(err) {
            plugin.lognotice("error looking up user " + JSON.stringify(err));
            return next(DENY, DSN.no_such_user())
        }

        if (user && user.emails[0] && user.emails[0].address) {
            var address = user.emails[0].address;
            //FIXME: leave here till beta
            if(address != "iovdin@gmail.com" && address != "ivanpashenko@gmail.com" && address.indexOf("test") != 0)
                return next(DENY, "not in beta yet");

            connection.transaction.parse_body = 1;
            var notes = connection.transaction.notes;
            var forwardEmail = new Address(address);
            rcpt.user = forwardEmail.user; 
            rcpt.host = forwardEmail.host; 
            notes.user = user;
            connection.relaying = true;
            //to get subject
            return next();
        } 

        //set to catch invoice email in queue_ok
        if(rcpt.user.indexOf("test") == 0) {
            //connection.transaction.notes.test_invoice = true;
            return next(OK);
        }

        return next(DENY, DSN.no_such_user());
    });
}

exports.hook_queue_ok = function(next, connection, msg){
    var plugin = this;
    var t = connection.transaction;


    var rcpt = t.rcpt_to[0];
    var rcptUser = rcpt.user;

    plugin.lognotice("queue_ok for " + rcpt.user + "@" + rcpt.host);
    if(rcptUser.indexOf("test") == 0){
        var testId = rcptUser.substr(rcptUser.lastIndexOf("-") + 1);
        var tests = server.notes.tests;
        //bounce or invoice
        if(rcptUser.indexOf("test-sender-email") == 0) {
            var url = t.header.get("X-Invoice");
            //invoice
            if(url) {
                plugin.loginfo("queue_ok sent invoice " + testId);
                tests.update({_id: testId}, { $set: { url:url, status : "invoice" }});
                //bounce
            } else {
                plugin.loginfo("queue_ok sent bounce " + testId);
                tests.update({_id: testId}, { $set: { status : "bounce" }});
            }
        } 

        if(rcptUser.indexOf("test-receiver-email") == 0 && ! t.notes.user) {
            tests.update({_id: testId}, { $set: {  status : "delivered" }});
        }
    }
    next();
}
