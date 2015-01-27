if (Meteor.isClient) {
    aliasValidateStatus = new ReactiveVar("");
    validateAlias = inputValidator("is_alias_taken", aliasValidateStatus);

    emailValidateStatus = new ReactiveVar("");
    validateEmail = inputValidator("is_email_taken", emailValidateStatus);

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
            $("#estimation").css("visibility", "visible");
            w = $(event.currentTarget).width();
            we = $("#estimation").width();
            $("#estimation").css("margin-left", -w/2-we/2-10);
            $("#estimation").addClass("animated fadeInUp");
            //console.log("input div:", event.currentTarget.textContent);
            var lprice = parseFloat(event.currentTarget.textContent) || 1;
            lprice*= 1;
            price.set(lprice)
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
                    lastError.set(error.error);
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


if (Meteor.isServer){
    Meteor.methods({
        signup: function (alias, email, price, btcAddress) {
            check(alias, String);
            check(email, String);
            check(price, Number);
            //check(arg2, [Number]);

            if(!alias) throw new Meteor.Error("signup.noalias");
            if(!email) throw new Meteor.Error("signup.noemail");
            if(!price) throw new Meteor.Error("signup.noprice");

            var count = Meteor.users.find({$or : [{emails : email}, {username : alias}]}).count();
            if(count > 0){
                throw new Meteor.Error("signup.userexists");
            }
            var userId = Accounts.createUser({username : alias, email : email});
            check(userId, String);
            var user = Meteor.users.findOne(userId);
            var params = {price : price}
            if(btcAddress){
                params['btc_address'] = btcAddress;
            }
            Meteor.users.update({ _id : userId }, {$set : params} )
            return true
        },
        is_alias_taken : function(alias){
            check(alias, Match.Where(function(value){
                return /^\S+$/.test(value)
            }));

            var count = Meteor.users.find({username : alias}).count();
            return count == 0;
        },
        is_email_taken : function(email){
            check(email, Match.Where(function(value){
                return /^\S+@\S+$/.test(value)
            }));
            var count = Meteor.users.find({"emails.address" : email}).count();
            return count == 0;
        }
    })
}
