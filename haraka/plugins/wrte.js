var _        = require('underscore');
var Address  = require('./address').Address;
var DSN      = require('./dsn');

exports.register = function() {
    this.register_hook('rcpt', 'wrte_test_emails');
    this.register_hook('rcpt', 'wrte_sent_by_localhost');
    this.register_hook('rcpt', 'wrte_special_emails');
    this.register_hook('rcpt', 'wrte_user_exists');
};

exports.hook_init_master = function(next) {
    var wrteConfig = this.config.get('wrte.json');
    server.notes.config = wrteConfig.main; 
    if(process.env.WRTE_DEBUG) {
        server.notes.config = wrteConfig.debug; 
    }
    //this.logdebug("config is " + JSON.stringify(server.notes.config));
    return next()
}

exports.wrte_test_emails = function (next, connection, params) { 
    var rcpt = params[0];
    if(rcpt.host == server.notes.config.test_domain) {
        connection.relaying = true;
        return next(OK);
    }
    next();
}

exports.wrte_sent_by_localhost = function (next, connection, params) {
    var rcpt = params[0];
    var plugin = this;
    var me = plugin.config.get('me');

    //allow web server and mail server to send messages
    if(rcpt.host != me){
        if(connection.remote_ip == "127.0.0.1"){
            this.loginfo("remote_ip == 127.0.0.1, (from web server or myself?), allow relay");
            connection.relaying = true;
            return next(OK);
        }
        return next(DENY, DSN.relaying_denied()) 
    }
    next();
}

//from Aaddress
//to - String or [String]
exports.replaceRcpt = function(transaction, from, to){
    var rcpts = transaction.rcpt_to;
    if(_.isString(to))
        to = [to];
    to = _(to).map(function(email){ 
        var addr = new Address(email);
        addr.original = from.original;
        return addr;
    });
    transaction.rcpt_to =  _.chain(rcpts).reject(function(rcpt){
        return (rcpt.toString() == from.toString());
    }).union(to).value();
}
exports.wrte_special_emails = function (next, connection, params) { 
    var rcpt = params[0];
    var plugin = this;
    var me = plugin.config.get('me');

    var reserved = ["noreply"];
    if(reserved.indexOf(rcpt.user) >= 0) {
        return next(DENY, DSN.no_such_user()) 
    }

    var specials = ["support", "delivery", "abuse"];

    if(specials.indexOf(rcpt.user) < 0) {
        return next();
    }

    this.replaceRcpt(connection.transaction, rcpt, server.notes.config[rcpt.user]);
    this.loginfo("recipients " + connection.transaction.rcpt_to);
    connection.relaying = true;
    return next(OK);
}


exports.wrte_user_exists = function (next, connection, params) {
    var rcpt = params[0];

    //this.loginfo("Got recipient: " + JSON.stringify(params));
    var plugin = this;
    var me = plugin.config.get('me');

    server.notes.users.findOne({ username : rcpt.user }, { fields : { username : 1, "emails.address" : 1, "emails.verified" : 1, amount : 1, currency : 1 } } , function(err, user) {
        if(err) {
            plugin.lognotice("error looking up user " + JSON.stringify(err));
            return next(DENY, DSN.no_such_user())
        }

        if (user && user.emails[0] && user.emails[0].address) {
            var address = user.emails[0].address;
            //FIXME: leave here till beta
            if(!user.emails[0].verified)
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

        return next(DENY, DSN.no_such_user());
    });
}

exports.hook_get_mx = function(next, hmail, domain){
    var me = this.config.get('me');
    if(domain == me){
        return next(OK, "127.0.0.1");
    }
    if(domain == server.notes.config.test_domain) {
        return next(OK, server.notes.config.test_mx);
    }
    return next();
}
