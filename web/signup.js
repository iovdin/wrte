if (Meteor.isClient) {
    aliasValidateStatus = new ReactiveVar("");
    validateAlias = inputValidator("is_alias_taken", aliasValidateStatus);

    emailValidateStatus = new ReactiveVar("");
    validateEmail = inputValidator("is_email_taken", emailValidateStatus);

    priceValidateStatus = new ReactiveVar("price_valid");
    validatePrice = _.debounce(function(price){
        var isValid = isPriceValid(price);
        console.log("isValid", isValid);
        priceValidateStatus.set(isValid);
    }, 500);


    Template.signup.events({
        "input #alias" : function(event){
            alias.set(event.currentTarget.textContent);
            validateAlias(alias.get()); 
            //console.log("alias validate status:", aliasValidateStatus);
        },
        "input #email" : function(event){
            email.set(event.currentTarget.textContent);
            validateEmail(email.get());
        },
        "input #price" : function(event){
            var priceText = event.currentTarget.textContent;
            var lprice;
            if(!priceText) {
                lprice = 0.1;
            } else {
                lprice = parseFloat(priceText);
            }
            validatePrice(lprice);
            price.set(lprice);

            $("#estimation").css("visibility", "visible");
            w = $(event.currentTarget).width();
            we = $("#estimation").width();
            $("#estimation").css("margin-left", -w/2-we/2-10);
            $("#estimation").addClass("animated fadeInUp");
        },
        "mouseover #price" : function(event){
            w = $(event.currentTarget).width();
            we = $("#estimation").width();
            //console.log("div price width:", w);
            $("#estimation").css("margin-left", -w/2-we/2-10);
            $("#estimation").css("visibility", "visible");
            $("#estimation").addClass("animated fadeInUp");
        },
        "mouseout #price" : function(event){
            $("#estimation").css("visibility", "hidden");
            $("#estimation").removeClass("animated fadeInUp");
        },
        "focusout #price" : function(event){
            $("#estimation").css("visibility", "hidden");
            $("#estimation").removeClass("animated fadeInUp");
        },
        "input #btcAddress" : function(event){
            event.preventDefault();
            btcAddress.set(event.currentTarget.value);
        },
        "change .input" : function(event){
            useOrCreate = event.currentTarget.value;
        },
        "click button" : function(event, template){
            event.preventDefault();
            var address = (useOrCreate == 'use') ? btcAddress.get() : undefined;

            Meteor.call("signup", alias.get(), email.get(), price.get(), address, function(error, result){
                if (error){
                    //console.log("Connected email:", email.get());
                    var e = error.error;
                    lastError.set(error.error);
                    if(e.indexOf("price_") >= 0) {
                        priceValidateStatus.set(e);
                    } else if(e.indexOf("email_") >= 0) {
                        emailValidateStatus.set(e);
                    } else if(e.indexOf("alias_") >= 0){
                        aliasValidateStatus.set(e);
                    }
                    return;
                }
                registredEmail.set(alias.get()+"@wrte.io")
                subscribeStatus.set("signup_done");
            });
        }
    });

    HTTP.get("https://bitpay.com/api/rates/USD", null, function(error, result){
        if(error) {
            console.log("failed to get btc ticker", e);
            return;
        }
        btc2usd.set(result.data.rate);
        console.log("btc2usd ", btc2usd.get());
    });

    //var mBTCRate = new ReactiveVar("Unknown");
    var btc2usd = new ReactiveVar("Unknown");   
    var price = new ReactiveVar(0.1);
    var alias = new ReactiveVar("");
    var email = new ReactiveVar("");
    var btcAddress = new ReactiveVar();
    var useOrCreate = "create";
    lastError = new ReactiveVar();

    Template.signup.helpers({
        mBTCRate : function(){
            if (_.isNumber(btc2usd.get())){
                var result = price.get() * btc2usd.get();
                return result.toFixed(2);
            }
            return "";
        }
    });
}

Accounts.config({
    //sendVerificationEmail : true,
forbidClientAccountCreation : true,
});

isPriceValid = function(price){
    if(!_.isNumber(price) || _.isNaN(price))
        return "price_nan";

    // minimum 1 satoshi
    // also take in account a fee, show a warning
    if ( price < 0.00000001 ) 
        return "price_toosmall";
    return "price_valid";
}

if (Meteor.isServer){
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

        if (!/^\S+$/.test(alias)) 
            return "alias_wrong_syntax";

        var count = Meteor.users.find({username : alias}).count();
        return (count == 0) ? "alias_valid" : "alias_exists";
    }
    Meteor.methods({
        signup: function (alias, email, price, btcAddress) {
            var aliasCheckStatus = isAliasTaken(alias);
            if(aliasCheckStatus != "alias_valid") {
                throw new Meteor.Error(aliasCheckStatus);
            }

            var emailCheckStatus = isEmailTaken(email);
            if(emailCheckStatus != "email_valid") {
                throw new Meteor.Error(emailCheckStatus);
            }

            var priceCheckStatus = isPriceValid(price);
            if(priceCheckStatus != "price_valid") {
                throw new Meteor.Error(priceCheckStatus);
                return priceCheckStatus;
            }

            var userId = Accounts.createUser({username : alias, email : email});
            check(userId, String);
            var user = Meteor.users.findOne(userId);
            var params = {price : price}
            if (btcAddress) {
                params['btc_address'] = btcAddress;
            }
            Meteor.users.update({ _id : userId }, {$set : params} )
            return "done";
        },
        is_alias_taken : isAliasTaken,
        is_email_taken : isEmailTaken,
        is_price_valid : isPriceValid
    });
}
