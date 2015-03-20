var _        = require('underscore');
var Address  = require('./address').Address;
var DSN      = require('./dsn');
var net_utils = require('./net_utils');

exports.register = function() {
    //this.register_hook('mail', 'wrte_whitelist_spf');
    this.register_hook('mail', 'wrte_auth');
    this.register_hook('rcpt', 'wrte_test_emails');
    this.register_hook('rcpt', 'wrte_sent_by_localhost');
    this.register_hook('rcpt', 'wrte_special_emails');
    this.register_hook('rcpt', 'wrte_user_exists');
};


exports.hook_init_master = function(next) {
    var wrteConfig = this.config.get('wrte.json');
    server.notes.config = wrteConfig.main; 
    server.notes.whitelist = this.config.get("wrte.whitelist", "list");
    if(process.env.WRTE_DEBUG) {
        server.notes.config = wrteConfig.debug; 
    }
    //this.logdebug("config is " + JSON.stringify(server.notes.config));
    return next()
}

exports.wrte_whitelist_spf = function (next, connection, params) { 
    //check if in white list and has valid spf record then pass
    var spf = connection.transaction.results.get("spf");
    if(spf.scope == "mfrom" && spf.domain && _.contains(server.notes.whitelist, spf.domain) && spf.result == "SoftFail") {

        return next(DENY, DSN.sec_unauthorized()) 
    }
}
exports.wrte_auth = function (next, connection, params) { 
    var plugin = this;
    var me = plugin.config.get('me');
    var results = connection.results;
    var from = params[0];

    if(!net_utils.is_rfc1918(connection.remote_ip) && from.host == me && !results.has('relay', 'pass','auth')) {
        return next(DENY, DSN.sec_unauthorized()) 
    }
    next();
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
        if (net_utils.is_rfc1918(connection.remote_ip)) {
            this.loginfo("remote_ip == 127.0.0.1, (from web server or myself?), allow relay");
            connection.relaying = true;
            return next(OK);
        }
        if(connection.results.has('relay', 'pass','auth')) {
            this.loginfo("allow relaying for authenticated user");
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

    var specials = ["support", "delivery", "abuse", "postmaster"];

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

    server.notes.users.findOne({ username : rcpt.user }, { fields : { username : 1, "emails.address" : 1, "emails.verified" : 1, "services.stripe" : 1, active : 1, amount : 1, currency : 1 } } , function(err, user) {
        if(err) {
            plugin.lognotice("error looking up user " + JSON.stringify(err));
            return next(DENY, DSN.no_such_user())
        }

        if (user && user.emails[0] && user.emails[0].address) {
            var address = user.emails[0].address;
            //TODO: leave here till beta
            if(!user.active){
                return next(DENY, "account is not active");
            }
            if(!user.emails[0].verified) {
                return next(DENY, "email is not verified");
            }
            if( user.amount > 0 && (!user.services || !user.services.stripe)) {
                return next(DENY, "account is not properly set up");
            }

            connection.transaction.parse_body = 1;
            var notes = connection.transaction.notes;
            notes.user = user;
            connection.relaying = true;
            //to get subject
            return next();
        } 

        return next(DENY, DSN.no_such_user());
    });
}

exports.hook_data_post = function(next, connection) {
    var plugin = this; 
    var t = connection.transaction;
    var me = plugin.config.get('me');
    
    if(t.notes.user) {
        var fwd = new Address(t.notes.user.emails[0].address);
        _.each(t.rcpt_to, function(rcpt){
            if(rcpt.user == t.notes.user.username && rcpt.host == me) {
                rcpt.user = fwd.user;
                rcpt.host = fwd.host;
            }
        });
    }
    next();
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
