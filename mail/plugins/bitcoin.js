// bitcoin

// documentation via: haraka -c /Users/iovdin/projects/btcmail/mail -h plugins/bitcoin

// Put your plugin code here
// type: `haraka -h Plugins` for documentation on how to create a plugin
//
var Address  = require('./address').Address;
var outbound = require('./outbound');
var DSN      = require('./dsn');
var _        = require('underscore');
var bitcore = require('bitcore');
var Insight = require('bitcore-explorers').Insight;

bitcore.Networks.defaultNework = bitcore.Networks.livenet;

exports.send_invoice = function(to, priceBTC, priceUSD, btcAddress) {
    var config = this.config.get("invoice.template", "data").join("\n");
    var content = _.template(config)({priceBTC : priceBTC, priceUSD : priceUSD, btcAddress : btcAddress});
    var plugin = this;
    outbound.send_email(new Address("noreply@wrte.io"), to, content, function(code, msg){
        plugin.loginfo("invoce sent " + code + ", " + JSON.stringify(msg))
    });
}

exports.hook_send_email = function(next, hmail){
    this.loginfo("hook_send_mail " + hmail.todo.mail_from.original + " -> " + hmail.todo.rcpt_to[0].original);
    //this.loginfo("hook_send_mail " + JSON.stringify(hmail, null, "  "));
    var paid_state = hmail.todo.notes.paid_state;
    if(!paid_state) return next();


    var address = hmail.todo.notes.address;
    var price = hmail.todo.notes.price;
    if(!address) {
        this.logerror("no btc address generated for email");
        return next();
    }
    var plugin = this;
    var insight = new Insight();
    plugin.loginfo("get spendings for address " + address);
    insight.getUnspentUtxos(address, function(err, utxos) {
        if (err) {
            plugin.logerror("can not retrieve unspent utxos " + JSON.stringify(err));
            return next(DELAY, 60);
            //return next();
        } 
        //TODO: count fee
        var sum = _.reduce(utxos, function(memo, utxo){
            if(utxo.satoshis) return memo + utxo.satoshis * 0.00000001;
            if(utxo.amount) return memo + utxo.amount; 
        }, 0);

        plugin.loginfo("address paid for", sum);

        var now = (new Date()).getTime();
        var qtime = hmail.todo.queue_time;
        if ( (now - qtime) * 0.001 > 1 * 60 ) {
            hmail.todo.notes.paid_state = "timeout";
        }

        if(sum == 0) 
            return next(DELAY, 60);

        if(sum < price){
            //TODO: refund
            hmail.todo.notes.paid_state = 'underpaid';
            return next();
        } 
        if(sum >= price){
            //TODO: return if possible
            hmail.todo.notes.paid_state = 'paid';
        }

        return next();
    });
}
exports.hook_get_mx = function(next, hmail){
    switch(hmail.todo.notes.paid_state){
        case "paid":
            return next();
        case "underpaid":
        case "timeout":
            return next(DENY, "not_paid");
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
    this.loginfo("hook_data");
    var plugin = this; 
    var t = connection.transaction;
    var me = plugin.config.get('me');

    if(t.notes.user && !t.notes.address) {
        var privateKey = new bitcore.PrivateKey();
        t.notes.privateKey = privateKey.toWIF();
        var publicKey = privateKey.toPublicKey();
        t.notes.address = publicKey.toAddress().toString();
        //paid address
        //t.notes.address = '13uXbcdbnmap8K1BuoUchUrxbXvYNJULgq';
        //underpaid address
        //t.notes.address = '13uXbcdbnmap8K1BuoUchUrxbXvYNJULgq';
        t.notes.price = t.notes.user.price; 
        t.notes.paid_state = 'invoice_sent';
        //t.notes.paid_state = 'paid';
        var btc2usd = 264.04;
        //plugin.send_invoice(t.mail_from, t.notes.price, t.notes.price * btc2usd, t.notes.address);
    }
    /*var msgId = t.header.get("Message-Id");
    if(!msgId) {
        msgId = '<' + t.uuid + '@' + me + '>';
        t.add_header('Message-Id', msgId);
    }*/

    //t.notes.price
    next();
}
