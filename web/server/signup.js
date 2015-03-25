Accounts.config({
    //sendVerificationEmail : true,
forbidClientAccountCreation : true,
});
var reservedNames = [ "mailer-daemon", "postmaster", "nobody", "hostmaster", "usenet", "news", "webmaster", "www", "mail", "ftp", "abuse", "noc", "security", "root", "noreply", "support", "wrte", "ilya", "ivan", "delivery", "admin"];

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
        return Meteor.users.find(this.userId, {fields: { username : 1, amount : 1, "currency" : 1, "services.stripe.ref" : 1, "services.stripe.stripe_publishable_key" : 1, "services.stripe.default_currency" : 1, "active" : 1 }});
    });

});


intercomUpdateUser = function(params){
    var intercomURL = "https://api.intercom.io/users"; 
    var intercomSettings = Meteor.absoluteUrl("").indexOf("http://localhost") == 0 ? Meteor.settings.intercom.test : Meteor.settings.intercom.live;

    //console.log("intercomSettings ", intercomSettings);
    var credentials = intercomSettings.appId + ":" + intercomSettings.key;
    //console.log("credentials ", credentials);
    var headers = {
        "Accept"        : "application/json"
    }
    var result = HTTP.post(intercomURL, { data : params, auth : credentials , headers : headers }, function(err, result){
        if(err){
            console.log("intercom update user", err);
        }
    });
}
Meteor.methods({
    signup: function (alias, email, amount) {
        var aliasCheckStatus = isAliasTaken(alias);
        if(aliasCheckStatus != "alias_valid") {
            throw new Meteor.Error(aliasCheckStatus);
        }

        var emailCheckStatus = isEmailTaken(email);
        if(emailCheckStatus != "email_valid") {
            throw new Meteor.Error(emailCheckStatus);
        }

        var amountCheckStatus = isAmountValid(amount);
        if(amountCheckStatus != "amount_valid") {
            throw new Meteor.Error(amountCheckStatus);
            return amountCheckStatus;
        }

        alias = alias.toLowerCase();
        var userId = Accounts.createUser({username : alias, email : email});
        check(userId, String);
        var user = Meteor.users.findOne(userId);
        var params = { amount : amount, currency : "usd"}
        params.active = true;
        Meteor.users.update({ _id : userId }, {$set : params});

        sendVerification(user, "signup/sendmoney", "Welcome to wrte.io", "verify_email");

        var tempToken = Random.secret();
        Meteor.users.update({_id : userId }, {$set : {'services.temp' : { token : tempToken, when : new Date() } }});

        var now = (new Date()).getTime();
        intercomUpdateUser({ user_id : userId, email : email, signed_up_at : now, last_request_at : now, custom_attributes : { username : alias, active : true, verified : false } });
        return tempToken;
    },
    changeUser : function(options){
        if(!Meteor.userId()){
            throw new Meteor.Error("not_authorized");
        }
        var params = {};
        if(options.amount){
            params.amount = options.amount;
            var amountCheckStatus = isAmountValid(options.amount);
            if(amountCheckStatus != "amount_valid") {
                throw new Meteor.Error(amountCheckStatus);
                return amountCheckStatus;
            }
        }
        if(options.sendTo){
            var svc = {ref : "watsi"};
            if(options.sendTo == "stripe") {
                if(!options.authCode) {
                    throw new Meteor.Error("empty_code");
                }
                //TODO: try catch
                svc = stripeGetToken(options.authCode);
            }
            params["services.stripe"] = svc;
        }
        Meteor.users.update({_id : Meteor.userId()}, {$set : params});
        return;
    },
    is_alias_taken : isAliasTaken,
    is_email_taken : isEmailTaken,
    is_amount_valid : isAmountValid
});
