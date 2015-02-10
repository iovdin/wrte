invoices = new Mongo.Collection("Invoice", {idGeneration: 'MONGO'});
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
    function createButton(user, custom, subject) {
        console.log("create button for " + user._id);
        var email = user.username + "@wrte.io" ;
        var data = { 
            "button": 
            {
                "account_id"  : coinbase.account_id,
                "name"               : "To: " + email,
                "type"               : "buy_now",
                "subscription"       : false,
                "price_string"       : String(user.price),
                "price_currency_iso" : "BTC",
                "custom"             : custom,
                "description"        : "Subject: " + subject,
                "style"              : "custom_large",
                "include_email"      : false
            }
        }

        var btn = coinbase.post("buttons", data);
        console.log("button created : " + JSON.stringify(btn.data, null, "  "));
        var code = btn.data.button.code;
        //console.log("button code : " + code + ", success: " + btn.data.success);
        if(btn.data.success && code){
            Meteor.users.update(user._id, {$set : { buttonCode : code }});
            return code;
        }
        return null;
    }
    function checkOrder(custom) {
        console.log("check order for " + custom);
        var order = coinbase.get("orders/" + custom);
        //https://api.coinbase.com/api/v1/orders/:id_or_custom_field
        return order.data;
    }

    WebApp.connectHandlers.use("/btc/create", function(req, res, next) {
        var params = url.parse(req.url, true).query;
        console.log("/btc/create " + JSON.stringify(params));
        //console.log("query " + JSON.stringify(params));
        //var params = { msgId : "123456", "userId" : "QQPYAMR523stZs7z9", subject : "hello", from : "Ilya Ovdin <iovdin@gmail.com>" };

        var invoiceId = new Mongo.ObjectID(params.id);
        var invoice = invoices.findOne({_id : invoiceId });

        //res.setHeader("Content-Type", "application/json");
        if(!invoice){
            res.writeHead(404);
            res.end(JSON.stringify({error : "invoice not found"}));
            return;

        }
        if(!invoice.buttonCode){
            var user = Meteor.users.findOne(invoice.userId, {fields : {username : 1, price : 1, buttonCode : 1, "emails.address" : 1}});
            if(!user) {
                res.writeHead(404);
                res.end(JSON.stringify({error : "user not found"}));
                return;
            }
            invoice.buttonCode = createButton(user, params.id, invoice.subject);
            invoices.update(invoiceId, {$set : {buttonCode : invoice.buttonCode}});
        }

        res.writeHead(200);
        res.end(JSON.stringify({ 
            id     : params.id,
            button : invoice.buttonCode,
            status : invoice.status,
        }));
    });

    WebApp.connectHandlers.use(bodyParser.json()).use("/btc/callback", Meteor.bindEnvironment(function(req, res, next) {
        //send message to mail server 
        //or send message to user 
        var r = req.body;
        //var r = {"order":{"id":"D1EB0F9B","created_at":"2015-02-09T06:59:34-08:00","status":"completed","event":{"type":"completed"},"total_btc":{"cents":10000.0,"currency_iso":"BTC"},"total_native":{"cents":10000.0,"currency_iso":"BTC"},"total_payout":{"cents":0.0,"currency_iso":"USD"},"custom":"54d8cb41f997a51a37f6bd91","receive_address":"13jPoXFUhz5DnS9G3dKoFJeGcubirH2ijC","button":{"type":"buy_now","subscription":false,"repeat":null,"name":"To: iovdin@wrte.io","description":"Subject: test Mon, 09 Feb 2015 17:59:13 +0300","id":"dc807b85e9a3df7854ccd70f0861c67a"},"refund_address":"16uVmsfR6gfyKfDQ6xCcn5hYki38Q1LvS8","transaction":{"id":"54d8cb6018138797080000bf","hash":null,"confirmations":0}}}
        console.log(JSON.stringify(r, null, "  ")); 
        res.writeHead(200);
        var invoiceId = new Mongo.ObjectID(r.order.custom);
        var orderId = r.order.id; 
        var invoice = invoices.findOne({_id : invoiceId});
        var order = checkOrder(orderId);
        var status = order.order.status;
        //TOOD: check status on coinbase server
        if(!invoice) {
            console.log("invoice: " + invoiceId + " not found");
        } else if(invoice.status == 'paid') {
            //TODO: refund
            console.log("invoice: " + invoiceId + " has already been paid");
        }else if(status == "completed"){
            invoices.update(invoiceId, {$set : {status : "paid", orderId : orderId}});
        } else {
            console.log("invoice is not paid " + status);
            //TODO: check fees
            //TODO: refund 
            //TODO: try to pay 2nd time
            invoices.update(invoiceId, {$set : {status : "error", orderId : orderId}});
        } 
        res.end("ok");
    }));
}
