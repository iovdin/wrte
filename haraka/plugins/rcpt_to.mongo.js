// rcpt_to.mongo

// documentation via: haraka -c /Users/iovdin/projects/btcmail/mail -h plugins/rcpt_to.mongo

// Put your plugin code here
// type: `haraka -h Plugins` for documentation on how to create a plugin
//
var Address = require('./address').Address;
var DSN = require('./dsn');

exports.hook_init_master = function(next) {
    var MongoClient = require('mongodb').MongoClient;
    var config = this.config.get("rcpt_to.mongo.ini");
    var dbURL = config.main.server;
    if(process.env.WRTE_DEBUG) {
        dbURL = config.debug.server;
    }

    this.loginfo("mongo server " + dbURL);
    //this.loginfo("arguments " + JSON.stringify(arguments));
    var inst = this;
    MongoClient.connect(dbURL, function(err, db) {
        if(err) {
            inst.logerror("failed to connect mongodb " + dbURL + " " + JSON.stringify(err));
        }
        server.notes.db = db;
        server.notes.users = db.collection('users');
        server.notes.invoices = db.collection('Invoice');
        //server.notes.tests = db.collection('Test');
        //server.notes.messages = db.collection('messages');
        next();
    });
}

/*exports.hook_queue_ok = function(next, connection, msg){
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
}*/
