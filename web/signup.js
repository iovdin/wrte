if (Meteor.isClient) {
    registredEmail = new ReactiveVar("");

    aliasValidateStatus = new ReactiveVar("default");
    validateAlias = inputValidator("is_alias_taken", aliasValidateStatus);

    emailValidateStatus = new ReactiveVar("default");
    validateEmail = inputValidator("is_email_taken", emailValidateStatus);

    priceValidateStatus = new ReactiveVar("default");
    validatePrice = _.debounce(function(price){
        var isValid = isPriceValid(price);
        console.log("isValid", isValid);
        priceValidateStatus.set(isValid);
    }, 500);
    resetValidator = function(){
        aliasValidateStatus.set("");
        emailValidateStatus.set("");
        priceValidateStatus.set("");
    }

    var stripe = new ReactiveVar(false);
    
/*    Template.sign.helpers({
      stripe: function () {
        return stripe.get();
      }
    });*/ 
    
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
                lprice = 0.001;
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

            //TODO: make usd as default
            var amount = (btc2usd.get() * price.get());
            amount = parseFloat(amount.toFixed(2));
            amount = Math.max(amount, 0.60);

            Meteor.call("signup", alias.get(), email.get(), price.get(), amount, function(error, result){
                if (error){
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
                resetValidator();
                Router.go("/signup/sendmoney")
                //subscribeStatus.set("signup_done");
            });
        },
        "click #radio_stripe" : function(event){
            stripe.set(true);
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
    var price = new ReactiveVar(0.001);
    var alias = new ReactiveVar("");
    var email = new ReactiveVar("");
    var btcAddress = new ReactiveVar();
    var useOrCreate = "create";

    Template.signup.helpers({
        mBTCRate : function(){
            if (_.isNumber(btc2usd.get())){
                var result = price.get() * btc2usd.get();
                return result.toFixed(2);
            }
            return "";
        }
    });
    Router.route('/signup', function(){
        this.render("signup");
    })
    Router.route('/signup/done', function(){
        this.render("signup_done");
    });
    Router.route('/signup/sendmoney', function(){
        this.render("signup_sendmoney");
    });
}

Accounts.config({
    //sendVerificationEmail : true,
forbidClientAccountCreation : true,
});


