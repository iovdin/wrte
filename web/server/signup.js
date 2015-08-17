Accounts.config({
    //sendVerificationEmail : true,
forbidClientAccountCreation : true,
});
var reservedNames = [ "mailer-daemon", "postmaster", "nobody", "hostmaster", "usenet", "news", "webmaster", "www", "mail", "ftp", "abuse", "noc", "security", "root", "noreply", "support", "wrte", "ilya", "ivan", "delivery", "admin"];

var Address = bitcore.Address;
var Networks = bitcore.Networks;

isBtcAddressValid = function(btcAddress){
    var network = btcTest ? Networks.testnet : Networks.livenet;
    var err = Address.getValidationError(btcAddress, network);
    if( !err ) return "btc_address_valid";
    return "btc_address_invalid";
}

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
        return Meteor.users.find(this.userId, {fields: { username : 1, amount : 1, "currency" : 1, "services.stripe.ref" : 1, "services.stripe.stripe_publishable_key" : 1, "services.stripe.default_currency" : 1, "services.btc" : 1, "active" : 1 }});
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

        sendVerification(user, "signup", "Welcome to wrte.io", "verify_email");

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
        /*if(options.sendTo == "btc") {
        }*/
        var btcCheckStatus = isBtcAddressValid(options.btcAddress);
        if(btcCheckStatus != "btc_address_valid") {
            throw new Meteor.Error(btcCheckStatus);
            return btcCheckStatus;
        }

        params["services.btc"] = { address : options.btcAddress };
        /*if(options.sendTo){
            params["services.stripe"] = {};
            params["services.btc"] = {};
            switch(options.sendTo) {
                case "watsi":
                    params["services.stripe"] = {ref : "watsi"};
                    break;
                case "stripe":
                    if(!options.authCode) {
                        throw new Meteor.Error("empty_code");
                    }
                    //TODO: try catch
                    params["services.stripe"] = stripeGetToken(options.authCode);
                    break;
                case "btc":
                    params["services.btc"] = { address : options.btcAddress };
                    break;
                default:
                    throw new Meteor.Error("wrong_payment", "Payment method not specified");
            }
        }*/
        Meteor.users.update({_id : Meteor.userId()}, {$set : params});
        return;
    },
    is_alias_taken : isAliasTaken,
    is_email_taken : isEmailTaken,
    is_amount_valid : isAmountValid,
    is_btc_address_valid : isBtcAddressValid,
    getWalletAddress : function(code, redirectUrl) {
        var params = {
            grant_type: "authorization_code",
            code : code,
            client_id: Meteor.settings.public.coinbase.clientId,
            client_secret: Meteor.settings.coinbase.clientSecret,
            redirect_uri: Meteor.absoluteUrl(redirectUrl, {secure : true})  
        }
        console.log("0");
        var authData = HTTP.post("https://api.coinbase.com/oauth/token", { params: params });
        var authHeaders = {
            "Authorization": "Bearer " + authData.data.access_token, 
            "CB-VERSION": "2015-08-15" 
        };
        console.log("1");
        var result = HTTP.get("https://api.coinbase.com/v2/accounts", { headers : authHeaders });
        var account;
        for(var i = 0; i< result.data.data.length; i++){
            var acc = result.data.data[i];
            if(acc.primary && acc.currency == "BTC" && acc.type == "wallet") {
                account = acc.id;
                //console.log("get account", acc);
                break;
            }
        }
        if(!account) {
            throw new Meteor.Error("account_notfound", "No account found");
        }
        var url = "https://api.coinbase.com/v2/accounts/" + account + "/addresses";
        //console.log("address url", url);
        console.log("2");
        result = HTTP.post(url, { headers : authHeaders, params : { name : "wrte.io" }});

        console.log("3");
        return result.data.data.address;
    }
});
