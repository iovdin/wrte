// bitcoin

// documentation via: haraka -c /Users/iovdin/projects/btcmail/mail -h plugins/bitcoin

// Put your plugin code here
// type: `haraka -h Plugins` for documentation on how to create a plugin
//
var Address  = require('./address').Address;
var outbound = require('./outbound');
var DSN      = require('./dsn');
var _        = require('underscore');
var url      = require('url');
//var bitcore = require('bitcore');
//var Insight = require('bitcore-explorers').Insight;

//bitcore.Networks.defaultNework = bitcore.Networks.livenet;

var Q_TIMEOUT = 2; //10; //how long keep email without invoice in queue
var QI_TIMEOUT = 10; //60 * 24; //how long keep email with invoice in queue
var CHECK_DELAY = 10; //60



exports.hook_send_email = function(next, hmail){
    //this.loginfo("hook_send_mail " + JSON.stringify(hmail, null, "  "));
    var user = hmail.todo.notes.user;
    var msgId = hmail.todo.notes.msgId;
    if(!user || !msgId) return next();

    var rcpt = hmail.todo.rcpt_to[0];
    this.loginfo("hook_send_mail " + hmail.todo.mail_from.original + " -> " + rcpt.original);

    var plugin = this;
    var invoices = server.notes.invoices;
    //var testId = null;
    //var tests = server.notes.tests;
    //if(rcpt.user.indexOf("test") == 0) {
        //testId = rcpt.user.substr(rcpt.user.lastIndexOf("-") + 1);
    //}

    invoices.findOne({ msgId : msgId }, {} , function(err, invoice) {
        if(err) {
            plugin.logerror("failed to find invoice for msgId : " + msgId + ", " + JSON.stringify(err));
            return next(DELAY, CHECK_DELAY);
        }

        var now = (new Date()).getTime();
        var qtime = hmail.todo.queue_time;
        // if user did not open invoice email for 10 min, remove it from queue
        if(!invoice &&  (now - qtime) * 0.001 > Q_TIMEOUT * 60 ) {
            plugin.lognotice("no invoice message pay timeout " + msgId);
            hmail.todo.notes.paid_state = "timeout";
            //if(testId) tests.update({_id: testId}, { $set: {  status : "timeout" }});
            return next();
        }

        plugin.loginfo("invoice for " + msgId + ":  " + JSON.stringify(invoice));
        if(invoice && invoice.status == "paid") {
            hmail.todo.notes.paid_state = "paid";
            //if(testId) tests.update({_id: testId}, { $set: {  status : "delivered" }});
            return next();
        }
        if(invoice && invoice.status.indexOf("err_") == 0) {
            hmail.todo.notes.paid_state = "error";
            //if(testId) tests.update({_id: testId}, { $set: {  status : "error" }});
            return next();
        }
        //if user created invoice but not 

        if(invoice && (now - qtime) * 0.001 > QI_TIMEOUT * 60 ){
            hmail.todo.notes.paid_state = "timeout";
            //if(testId) tests.update({_id: testId}, { $set: {  status : "timeout" }});
            plugin.lognotice("invoice message pay timeout " + msgId);
            return next();
        }

        return next(DELAY, CHECK_DELAY);
    });
}

exports.hook_get_mx = function(next, hmail, domain){
    switch (hmail.todo.notes.paid_state){
        case "timeout":
            return next(DENY, "not_paid");
        case "error":
            return next(DENY, "error");
        case "paid":
            break;

    }
    var me = this.config.get('me');
    if(domain == me){
        return next(OK, "127.0.0.1");
    }
    return next();
}
exports.hook_bounce = function(next, hmail, error){
    //TODO: refund on bounce
    if (!hmail.todo.notes.user) {
        return next(OK);
    }
    next();
}

exports.hook_data = function(next, connection) {
    var plugin = this; 
    var t = connection.transaction;
    var me = plugin.config.get('me');

    if(t.notes.user) {
        this.loginfo("hook_data");
        var query = {};

        var msgIds = t.header.get_all("Message-Id");
        var msgId = "";
        if(!msgIds.length) {
            msgId = '<' + t.uuid + '@' + me + '>';
            t.add_header('Message-Id', msgId);
        } else {
            msgId = msgIds[0];
        }

        query.msgId = msgId;
        query.userId = t.notes.user._id;
        query.from = t.mail_from.original;
        query.subject = "";

        t.notes.msgId = msgId;
        var u = url.format({ protocol : "http", hostname : "wrte.io", pathname : "/btc/create", query : query });
        plugin.send_invoice(t.mail_from, msgId, u);
    }
    next();
}


var trans       = require('./transaction');
var constants   = require('./constants');

exports.send_invoice = function(to, msgId, url) {
    this.loginfo("send invoice to " + to);
    var config = this.config.get("invoice.template", "data").join("\n");

    var content = _.template(config)({ url : url});
    var plugin = this;

    var from = new Address("noreply@wrte.io");
    from.original = "wrte.io <noreply@wrte.io>";
    var to   = new Address(to);

    var transaction = trans.createTransaction();
    transaction.mail_from = from;
    transaction.rcpt_to = [to];
    transaction.add_header("In-Reply-To", msgId);
    transaction.add_header("References", msgId);
    transaction.add_header("X-Invoice", url);

    this.loginfo("Created transaction: " + transaction.uuid);

    // Set data_lines to lines in content
    var match;
    var re = /^([^\n]*\n?)/;
    while (match = re.exec(content)) {
        var line = match[1];
        line = line.replace(/\n?$/, '\r\n'); // make sure it ends in \r\n
        transaction.add_data(new Buffer(line));
        content = content.substr(match[1].length);
        if (content.length === 0) {
            break;
        }
    }
    transaction.message_stream.add_line_end();
    outbound.send_trans_email(transaction, function(code, msg){
        plugin.loginfo("invoice sent " + code + " " + msg);
    });
}
