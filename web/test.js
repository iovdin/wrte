if (Meteor.isServer){
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
            console.log("got test" + JSON.stringify(test));
            var invoice = createInvoice(test);
            console.log("got invoice" + JSON.stringify(invoice));
            if(testName == "delivered") {
                var cbresult = HTTP.post(localhost + "btc/callback/" + invoice.id, { data : { address : invoice.btcAddress, amount : invoice.price } });
            } 
        }, 1000);
    }));
}
