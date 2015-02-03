invoices = new Mongo.Collection("Invoice");
if(Meteor.isServer){
    //stirng params
    String.prototype.toUint8Array = function() {
        var i, d = unescape(encodeURIComponent(this)), b = new Uint8Array(d.length);
        for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
        return b;
    };

    Uint8Array.prototype.toHex = function(){
        var hexEncodeArray = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', ];
        var s = '';
        for (var i = 0; i < this.length; i++) {
            var code = this[i];
            s += hexEncodeArray[code >>> 4];
            s += hexEncodeArray[code & 0x0F];
        }
        return s;
    }

    sha246hmac = function(message, key){
        var result = sha256.hmac(key.toUint8Array(), message.toUint8Array());
        return result.toHex();
    }
    coinbase = {
        get : function(path, params){
            var url = coinbase.url + path;
            //TODO: better nonce
            var nonce = (new Date()).getTime();
            var signature = sha246hmac(nonce + url, coinbase.secret);
            return HTTP.get(url, {
                headers: {
                    'ACCESS_KEY'       : coinbase.key,
                    'ACCESS_SIGNATURE' : signature,
                    'ACCESS_NONCE'     : nonce
                }
            });
        },
        post : function(path, params){
            var body = JSON.stringify(params) || "";
            var url = coinbase.url + path ;
            //TODO: better nonce
            var nonce = (new Date()).getTime();
            var signature = sha246hmac(nonce + url + body, coinbase.secret);
            return HTTP.post(url, {
                content : body,
                headers: {
                    "Content-Type": "application/json",
                    'ACCESS_KEY'       : coinbase.key,
                    'ACCESS_SIGNATURE' : signature,
                    'ACCESS_NONCE'     : nonce
                }
            });
        },
    } 
    _.extend(coinbase, Meteor.settings.coinbase);

    WebApp.connectHandlers.use("/btc/create", function(req, res, next) {
        //save the whole message?
        var params = url.parse(req.url, true).query;
        //console.log("query " + JSON.stringify(params));
        //var params = { msgId : "123456", "userId" : "QQPYAMR523stZs7z9", subject : "hello", from : "Ilya Ovdin <iovdin@gmail.com>" };

        var invoice = invoices.findOne({msgId : params.msgId })

        if(invoice){
            res.writeHead(200);
            res.end(JSON.stringify({btcAddress : invoice.btcAddress, status : invoice.status}));
            return;
        }

        var user = Meteor.users.findOne(params.userId, {fields : {price : 1}});
        res.setHeader("Content-Type", "application/json");
        if(!user) {
            res.writeHead(404);
            res.end(JSON.stringify({error : "user not found"}));
            return;
        }
        var invoice = invoices.findOne({msgId : params.msgId});
        var result = undefined;
        if (!invoice) {
            invoice = {
                msgId : params.msgId,
                userId : user._id, 
                price : user.price, 
                subject : params.subject,
                from : params.from,
                status : "created"
            }
            invoice._id = invoices.insert(invoice);
        } 
        if(!invoice.btcAddress){
            var r = coinbase.post("accounts/" + coinbase.account_id + "/address", {
                "address": {
                    "callback_url": "https://wrte.io/btc/callback/" + invoice._id,
                    "label": user._id
                }
            });

            //console.log("coinbase response " + JSON.stringify(r, null, "  "));
            invoices.update(invoice._id, {$set : {btcAddress : r.data.address}});
            invoice.btcAddress = r.data.address;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ 
            btcAddress : invoice.btcAddress,
            status     : invoice.status,
            price      : invoice.price,
            id         : invoice._id,
        }));
    });

    WebApp.connectHandlers.use(bodyParser.json()).use("/btc/callback/", Meteor.bindEnvironment(function(req, res, next) {
        //send message to mail server 
        //or send message to user 
        var invoiceId = req.url.substr(1);
        var invoice = invoices.findOne(invoiceId);
        var r = req.body;
        console.log("called " + req.url);
        console.log(req.body);

        res.writeHead(200);
        if(!invoice) {
            console.log("invoice: " + invoiceId + " not found");
        } else if(invoice.status == 'paid') {
            console.log("invoice: " + invoiceId + " has already been paid");
        }else if(r.address != invoice.btcAddress){
            console.log("invoice: " + invoiceId + " addresses do not match got:" + r.address + " target:" + invoice.btcAddress);
            invoices.update(invoiceId, {$set : {status : "err_addr_dont_match"}});
        } else if(r.amount < invoice.price) {
            console.log("invoice: " + invoiceId + " got not enough :" + r.amount + " target: " + invoice.price);
            //TODO: check fees
            //TODO: refund 
            invoices.update(invoiceId, {$set : {status : "err_not_enough"}});
        } else {
            console.log("invoice: " + invoiceId + " got paid");
            invoices.update(invoiceId, {$set : {status : "paid"}});
        }
        res.end("ok");
    }));
}
