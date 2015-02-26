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
var mimelib  = require("mimelib");

exports.hook_init_master = function(next) {
    this.invoices = {};
    //this.on_check_payment.bind(this);
    setTimeout(this.on_check_payment.bind(this), server.notes.config.check_time * 1000);
    return next();
}
exports.on_check_payment = function(){
    var plugin = this;
    var timeout = server.notes.config.pay_invoice_timeout;
    //var timeout = 3600 * 24;
    var since = (new Date()).getTime() -  timeout * 1000 * 2;
    //TODO: only with status != "created"
    server.notes.invoices.find({createdAt : {$gt : new Date(since)}}).toArray(function(err, results){
        if(err){
            plugin.logerror("error finding invoice ", err);
            return;
        }
        var len = results.length;
        for(var i = 0; i < len; i++){
            var invoice = results[i];
            plugin.invoices[invoice._id] = invoice.status;
        }
        //plugin.logdebug("invoices", JSON.stringify(plugin.invoices, null, "  "));
        setTimeout(plugin.on_check_payment.bind(plugin), server.notes.config.check_time * 1000);
    });
}
exports.hook_data_post = function(next, connection) {
    var plugin = this; 
    var t = connection.transaction;
    var me = plugin.config.get('me');

    if(t.notes.user) {
        this.loginfo("hook_data_post");
        //var query = {};

        var msgIds = t.header.get_all("Message-Id");
        var msgId = "";
        if(msgIds.length == 0) {
            msgId = '<' + t.uuid + '@' + me + '>';
            t.add_header('Message-Id', msgId);
        } else {
            msgId = msgIds[0].trim();
        }

        t.notes.subject = mimelib.parseMimeWords(t.body.header.get("Subject").trim());
        t.notes.msgId = msgId;

        var invoice = {
            _id : t.uuid,
            createdAt : new Date(),
            status : "created",
            userId : t.notes.user._id, 
            from : t.mail_from.user + "@" + t.mail_from.host,
            to : t.notes.user.username + "@" + me,
            subject : t.notes.subject,
            amount : t.notes.user.amount,
            currency : t.notes.user.currency
        }

        server.notes.invoices.insert([invoice], function(err, result){
            //TODO: soft error?
            if(err){
                plugin.logerr("error invoice creation " + JSON.stringify(err));
                t.notes.paid_state = "error";
                return next(DENY, "server error");
            }
            if(!result.ops || result.ops.length == 0) {
                plugin.logerr("error invoice creation : nothing is inserted");
                t.notes.paid_state = "error";
                return next(DENY, "server error");
            }


            var r = result.ops[0];
            //plugin.loginfo("invoice creation result " + JSON.stringify(result.ops));
            t.notes.invoiceId = r._id;
            //t.notes.invoiceUrl = url.format({ protocol : "http", hostname : me, pathname : "/invoice/" + r._id});
            //t.notes.refundUrl = url.format({ protocol : "http", hostname : me, pathname : "/invoice/" + r._id + "/refund"});
            t.notes.amount = t.notes.user.amount;
            t.notes.currency = t.notes.user.currency.toUpperCase();
            t.notes.status = "invoice_sent";
            var from = new Address("delivery@wrte.io");
            plugin.send_invoice(from, t.mail_from, t.notes);
            return next();
        });
        return;
    }
    next();
}

exports.delay = function(hmail){
    var plugin = this;
    var notes = hmail.todo.notes;
    var invoiceStatus = plugin.invoices[notes.invoiceId];
    var openTimeout = server.notes.config.open_invoice_timeout;
    var payTimeout = server.notes.config.pay_invoice_timeout;
    //this.logdebug("called delay " + invoiceStatus);
    var now = (new Date()).getTime();
    var qtime = hmail.todo.queue_time;

    if(invoiceStatus == "created" &&  (now - qtime) * 0.001 > openTimeout) {
        notes.status = "invoice_timeout_open";
        return true;
    }

    if(invoiceStatus == "paid") {
        notes.status = "invoice_paid";
        return true;
    }
    if(invoiceStatus == "mispaid") {
        notes.status = "invoice_mispaid";
        return true;
    }

    if(invoiceStatus != "created" && (now - qtime) * 0.001 > payTimeout) {
        notes.status = "invoice_timeout_pay";
        notes.failReason = "Payment timeout";
        return true;
    }

    return false;
}

exports.hook_send_email = function(next, hmail){
    //this.loginfo("hook_send_mail " + JSON.stringify(hmail, null, "  "));
    var notes = hmail.todo.notes;
    var user = notes.user;
    var msgId = notes.msgId;
    var plugin = this;
    if(!user || !msgId) {

        return next();
    }
    var rcpt = hmail.todo.rcpt_to[0];
    this.loginfo("hook_send_mail " + hmail.todo.mail_from.original + " -> " + rcpt.original);
    var plugin = this;


    var delivery = new Address("delivery@wrte.io");
    if(notes.status == "invoice_paid") {
        return next();
    } 

    if(notes.status == "invoice_timeout_open") {
        return next(STOP);
    }

    if(notes.status == "invoice_timeout_pay") {
        server.notes.invoices.update({_id : notes.invoiceId}, {$set :{status : "timeout_pay"}}, 
                function(err, result){
            plugin.send_fail(delivery, hmail.todo.mail_from, notes);
            return next(STOP);
        });
        return;
    }

    if(notes.status == "invoice_mispaid") {
        this.send_fail_refund(delivery, hmail.todo.mail_from, notes);
        return next(STOP);
    }
    /*if(notes.failReason) {
        this.send_fail(delivery, hmail.todo.mail_from, notes);
        return next(STOP);
    }*/

    if(notes.status == 'invoice_sent') {
        var handler = _.bind(this.delay, this);
        handler.toString = function(){
            return "[function delay]";
        }
        return next(DELAY, handler);
    }

    return next(STOP);
}

exports.hook_delivered = function(next, hmail, args){
    //TODO: bounce hook on not delivered but paid email 
    //this.loginfo("hook_delivered ", arguments);
    var delivery = new Address("delivery@wrte.io");
    //var notes = hmail.todo.notes;
    if(hmail.todo && hmail.todo.notes && hmail.todo.notes.status == "invoice_paid") {
        this.send_confirm(delivery, hmail.todo.mail_from, hmail.todo.notes);
    } 
    next();
}
exports.send_invoice = function(from, to, notes) {
    var plugin = this;
    var me = plugin.config.get('me');
    var email = notes.user.username + "@" + me;
    var params = _.extend({email: email}, notes);
    plugin.lognotice("send invoice to " + to);
    plugin.logdebug("invoice url " + notes.invoiceUrl);
    this.send_email_template(from, to , "invoice.template", params);
}

exports.send_confirm = function(from, to, notes) {
    var plugin = this;
    var me = plugin.config.get('me');
    var email = notes.user.username + "@" + me;
    var params = _.extend({email: email}, notes);
    plugin.lognotice("send delivery succesed " + to);
    this.send_email_template(from, to, "delivered.template", params);

}

exports.send_fail_refund = function(from, to, notes) {
    var plugin = this;
    var me = plugin.config.get('me');
    var email = notes.user.username + "@" + me;
    var params = _.extend({email: email}, notes);
    plugin.lognotice("send delivery fail to " + to + " please click to refund :" + notes.failReason);
    this.send_email_template(from, to, "notdelivered_refund.template", params);
}

exports.send_fail = function(from, to, notes) {
    var plugin = this;
    var me = plugin.config.get('me');
    var email = notes.user.username + "@" + me;
    var params = _.extend({email: email}, notes);
    plugin.lognotice("send delivery fail to " + to + " with reason :" + notes.failReason);
    this.send_email_template(from, to, "notdelivered.template", params);
}

exports.send_email_template = function(from, to, template, params, next){
    var config = this.config.get(template, "data").join("\n");
    var content = _.template(config)(params);
    outbound.send_email(from, to, content, next);
}
