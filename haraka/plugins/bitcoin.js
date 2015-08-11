// bitcoin

// documentation via: haraka -c /Users/iovdin/projects/btcmail/mail -h plugins/bitcoin

// Put your plugin code here
// type: `haraka -h Plugins` for documentation on how to create a plugin
//
var BTCAddress = require('bitcore').Address;
var Address    = require('./address').Address;
var outbound   = require('./outbound');
var DSN        = require('./dsn');
var _          = require('underscore');
var url        = require('url');
var mimelib    = require("mimelib");
var request    = require("request");

exports.hook_init_master = function(next) {
    this.invoices = {};
    this.btcInvoices = [];

    setTimeout(this.on_check_payment.bind(this), server.notes.config.check_time * 1000);
    setTimeout(this.on_check_bitcoin_payment.bind(this), server.notes.config.check_time * 1000);
    setTimeout(this.fetchBTCRates.bind(this), server.notes.config.btc_rates_time * 1000);
    this.fetchBTCRates(next);
}

exports.fetchBTCRates = function(next){
    var plugin = this;
    request({
        url:  "https://bitpay.com/api/rates",
        json: true
    }, function (error, response, body) {
        if(error) {
            plugin.logerror("error fetching bitcoin rates " + error);
        } else {
            plugin.loginfo("got bitcoin rates");
        }
        if (!error && response.statusCode === 200) {
            plugin.rates = {};
            for(var i = 0; i < body.length; i++){
                plugin.rates[body[i].code] = body[i].rate;
            }
        }
        if(next) next();
    })
}
exports.on_check_bitcoin_payment = function (){
    var plugin = this;
    
    var invoice = plugin.btcInvoices[0];
    var next = function(pushBack){
        invoice = plugin.btcInvoices.shift();
        if(pushBack && invoices) 
            plugin.btcInvoices.push(invoice); 

        setTimeout(plugin.on_check_bitcoin_payment.bind(plugin), server.notes.config.check_time * 5000);
    }
    if(!invoice){
        next();
        return;
    }
    try{
        var address = invoice.btc.address;
        var btcAddress = new BTCAddress(address);
        var url = (btcAddress.network.name == "livenet") ? "https://insight.bitpay.com" : "https://test-insight.bitpay.com"

        url += "/api/addrs/" + address + "/txs";
        plugin.loginfo("fetching url " + url);
        request({
            url:  url,
            json: true
        }, function (error, response, body) {
            if(error) {
                plugin.logerror("error fetching txs for " + address + " : " + error);
                return;
            } 
            //TODO: paging
            //plugin.loginfo("got transactions ", JSON.stringify(body, null, "  "));
            for(var i = 0, len = body.items.length; i < len; i++){
                var tx = body.items[i];
                if(!tx || !tx.vout) continue;
                var received = 0;
                for(var j = 0, jlen = tx.vout.length; j < jlen; j++){
                    var vout = tx.vout[j];
                    var value = parseFloat(vout.value);
                    var key = vout.scriptPubKey;
                    if(key && key.addresses && key.addresses.indexOf(address) >= 0) {
                        received += value;
                    }
                }
                if(Math.abs(received - invoice.btc.amount) < 0.00000001){
                    //TODO: check number of confirmations
                    plugin.loginfo("found tx", tx);
                    server.notes.invoices.update({_id : invoice._id}, {$set : {status: "paid"}}, 
                                                 function(err, result){
                                                     next();
                                                 });
                    return;
                }
            }
            next(true);
        });
    } catch (e) {
        plugin.logwarn("error checking btc address " + address);
        plugin.logerror(e);
        next(true);
    }
}

exports.on_check_payment = function(){
    var plugin = this;
    var timeout = server.notes.config.pay_invoice_timeout;
    //var timeout = 3600 * 24;
    var since = (new Date()).getTime() -  timeout * 1000 * 2;
    //TODO: only with status != "created"
    server.notes.invoices.find({createdAt : {$gt : new Date(since)}}).toArray(function(err, results) {
        if(err){
            plugin.logerror("error finding invoice ", err);
            return;
        }
        var len = results.length;
        for(var i = 0; i < len; i++){
            var invoice = results[i];
            plugin.invoices[invoice._id] = invoice.status;
            if(invoice.btc && invoice.status == "opened") {
                plugin.btcInvoices.push(invoice);
            }
        }
        plugin.btcInvoices = _.uniq(plugin.btcInvoices, false, _.iteratee('_id'));
        //plugin.logdebug("invoices", JSON.stringify(plugin.invoices, null, "  "));
        setTimeout(plugin.on_check_payment.bind(plugin), server.notes.config.check_time * 1000);
    });
}

function round(num, precision) {
    var prec = Math.pow(10, precision);
    return Math.trunc(num * prec) / prec;
}

exports.hook_data_post = function(next, connection) {
    var plugin = this;
    var t = connection.transaction;
    var me = plugin.config.get('me');

    if(t.notes.user) {
        this.loginfo("hook_data_post");

        if(_.contains(server.notes.whitelist, t.mail_from.host)){
            this.loginfo("hook_data_post in whitelist");
            return next();
        }
        //pass free emails
        if(t.notes.user.amount == 0) {
            return next();
        }
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

        var stripe = t.notes.user.services.stripe;
        var btc = t.notes.user.services.btc;
        if(stripe && stripe.stripe_publishable_key) {
            invoice.stripePublishableKey = stripe.stripe_publishable_key;
        } else if(btc && btc.address){
            invoice.btc = { address : btc.address };
            var rate = invoice.btc.rate = plugin.rates[invoice.currency.toUpperCase()];
            if (!rate) {
                t.notes.paid_state = "error";
                return next(DENY, "server error");
            }
            // 244 usd per bitcoin * 0.00001 < 1 cent 
            //0.000 000 01
            //1 satoshi
            invoice.btc.uid = Math.trunc(Math.random() * Math.pow(10, 3));
            invoice.btc.amount = round(invoice.amount / rate, 5) + invoice.btc.uid / Math.pow(10, 8);
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


exports.delay = function(hmail) {
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
        var notes = hmail.todo.notes;
        this.send_confirm(delivery, hmail.todo.mail_from, hmail.todo.notes);
        server.notes.invoices.update({ _id : notes.invoiceId } , { $set: { status : 'delivered' } }, function(err, result) {

            return next();
        });
        return;
    }  
    next();
}
exports.send_invoice = function(from, to, notes) {
    var plugin = this;
    var me = plugin.config.get('me');
    var email = notes.user.username + "@" + me;
    var params = _.extend({email: email}, notes);
    var services = notes.user.services;
    var template = "invoice.template";
    /*if(!services.stripe || !services.stripe.stripe_publishable_key ) {
        template = "invoice_charity.template";
    }*/
    plugin.lognotice("send invoice to " + to + " with template " + template);
    this.send_email_template(from, to , template, params);
}

exports.send_confirm = function(from, to, notes) {
    var plugin = this;
    var me = plugin.config.get('me');
    var email = notes.user.username + "@" + me;
    var params = _.extend({email: email}, notes);
    plugin.lognotice("send delivery succeed " + to);
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
