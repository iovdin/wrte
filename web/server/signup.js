var reservedNames = ["noreply", "support"];
function isEmailTaken(email){
    if(!email) 
        return "email_empty";
    if( !/^\S+@\S+$/.test(email)) 
        return "email_wrong_syntax";
    var count = Meteor.users.find({"emails.address" : email}).count();
    return (count == 0) ? "email_valid" : "email_exists" ;
}
function isAliasTaken(alias){
    if (!alias) 
        return "alias_empty";
    alias = alias.toLowerCase();

    if (!/^\S+$/.test(alias)) 
        return "alias_wrong_syntax";

    if(reservedNames.indexOf(alias) >= 0)
        return "alias_exists";

    if(alias.indexOf("test") == 0)
        return "alias_exists";

    var count = Meteor.users.find({username : alias}).count();
    return (count == 0) ? "alias_valid" : "alias_exists";
}
Meteor.startup(function () {
    Meteor.publish("me", function () {
        if(!this.userId) return [];
        return Meteor.users.find(this.userId, {fields: { username : 1, amount : 1, "currency" : 1, "services.stripe.ref" : 1, "services.stripe.stripe_publishable_key" : 1, "services.stripe.default_currency" : 1 }});
    });
});
Meteor.methods({
    signup: function (alias, email, priceBTC, amountUSD) {
        var aliasCheckStatus = isAliasTaken(alias);
        if(aliasCheckStatus != "alias_valid") {
            throw new Meteor.Error(aliasCheckStatus);
        }

        var emailCheckStatus = isEmailTaken(email);
        if(emailCheckStatus != "email_valid") {
            throw new Meteor.Error(emailCheckStatus);
        }

        var priceCheckStatus = isPriceValid(priceBTC);
        if(priceCheckStatus != "price_valid") {
            throw new Meteor.Error(priceCheckStatus);
            return priceCheckStatus;
        }

        alias = alias.toLowerCase();
        var userId = Accounts.createUser({username : alias, email : email});
        check(userId, String);
        var user = Meteor.users.findOne(userId);
        var params = {price : priceBTC, amount : amountUSD, currency : "usd"}
        Meteor.users.update({ _id : userId }, {$set : params});

        var welcomeTemplate = _.template(Assets.getText("email_templates/welcome.txt"));

        Email.send({
            to : email,
            from : "Wrte <support@wrte.io>",
            subject : "Welcome to Wrte.io",
            text : welcomeTemplate({email : alias + "@wrte.io"}),
        });

        var emailToken = Random.secret();
        Meteor.users.upsert(user._id, {$set : {'services.email' : { token : emailToken, when : new Date() } }});

        return emailToken;
    },
    sendmoney : function(sendTo, authCode){
        if(!Meteor.userId()){
            throw new Meteor.Error("not_authorized");
        }
        var svc = {ref : "watsiId"};
        if(sendTo == "stripe") {
            if(!authCode) {
                throw new Meteor.Error("empty_code");
            }
            //TODO: try catch
            svc = stripeGetToken(authCode);
        }
        Meteor.users.update({_id : Meteor.userId()}, {$set : {"services.stripe" : svc }});
        return;
    },
    is_alias_taken : isAliasTaken,
    is_email_taken : isEmailTaken,
    is_price_valid : isPriceValid
});
