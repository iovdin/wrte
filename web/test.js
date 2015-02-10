if (Meteor.isServer) {
    tests = new Mongo.Collection("Test");

    var domain = "wrte.io";
    function createTestAccount(){
        var testId = tests.insert({ msgId : "", url : "", "status" : "created"});
        var testReceiverAlias = "test-receiver-alias-" + testId;
        var testReceiverEmail = "test-receiver-email-" + testId + "@" + domain;
        var testSenderEmail = "test-sender-email-" + testId + "@" + domain;
        var userId = Accounts.createUser({username : testReceiverAlias, email : testReceiverEmail});
        Meteor.users.update(userId, {$set : {price : 0.0001}});
        return {testId : testId, sender : testSenderEmail, receiver : testReceiverAlias + "@" + domain};
    }
    function createInvoice(test){
        var u = test.url;
        var idx = u.indexOf("http://wrte.io/");
        if( idx == 0 ){
            var localhost = Meteor.absoluteUrl(null, {replaceLocalhost : true});
            //create invoice
            var u = localhost + u.substr(15);
            console.log("create invoice " + u);
            var invoice = HTTP.get(u).data;
            return invoice;
        } 
        return null;
    }
    WebApp.connectHandlers.use("/test/", Meteor.bindEnvironment(function(req, res, next) {
        var testName = req.url.substr(1);

        var testAccount = createTestAccount();
        console.log("create test " + testAccount.testId);

        Email.send({
            to : testAccount.receiver,
            from : testAccount.sender,
            subject : "Hello world",
            text : " Please reply, i've paid",
        });
        Meteor.setTimeout(function(){
            var test = tests.findOne(testAccount.testId);
            console.log("got test " + JSON.stringify(test));
            var invoice = createInvoice(test);
            console.log("got invoice " + JSON.stringify(invoice));
            if(testName == "delivered") {
                var data = {
                    "order": {
                        "id": "5RTQNACF",
                        "created_at": "2012-12-09T21:23:41-08:00",
                        "status": "completed",
                        "event": {
                            "type": "completed"
                        },
                        "total_btc": {
                            "cents": 100000000 * testAccount.price,
                            "currency_iso": "BTC"
                        },
                        "custom": invoice.id,
                        "receive_address": "1NhwPYPgoPwr5hynRAsto5ZgEcw1LzM3My",
                        "button": {
                            "type": "buy_now",
                            "name": "Alpaca Socks",
                            "description": "The ultimate in lightweight footwear",
                            "id": "5d37a3b61914d6d0ad15b5135d80c19f"
                        },
                        "transaction": {
                            "id": "514f18b7a5ea3d630a00000f",
                            "hash": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
                            "confirmations": 0
                        },
                        "refund_address": "1HcmQZarSgNuGYz4r7ZkjYumiU4PujrNYk"
                                },
                            }
                var localhost = Meteor.absoluteUrl(null, {replaceLocalhost : true});
                var cbresult = HTTP.post(localhost + "btc/callback" , { data : data });
            } 

            res.writeHead(200);
            res.end("ok");
        }, 1000);
    }));
}
