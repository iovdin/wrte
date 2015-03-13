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
    resetValidators = function(){
        aliasValidateStatus.set("");
        emailValidateStatus.set("");
        priceValidateStatus.set("");
    }

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
        "click button" : function(event, template){
            event.preventDefault();

            //TODO: make usd as default
            var amount = (btc2usd.get() * price.get());
            amount = parseFloat(amount.toFixed(2));
            amount = Math.max(amount, 0.60);

            Meteor.call("signup", alias.get(), email.get(), price.get(), amount, function(error, token){
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
                Meteor.loginWithToken(token, function(error, result){
                    console.log("logged in with token ", error, result);
                    if(error){
                        //TODO: error
                        console.log("error logging in", error);
                        return;
                    }
                    Router.go("/signup/sendmoney")
                });
                registredEmail.set(alias.get()+"@wrte.io")
                resetValidators();
                //subscribeStatus.set("signup_done");
            });
        },
    });

    HTTP.get("https://bitpay.com/api/rates/USD", null, function(error, result){
        if(error) {
            console.log("failed to get btc ticker", e);
            return;
        }
        btc2usd.set(result.data.rate);
        //console.log("btc2usd ", btc2usd.get());
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

    var sendTo = new ReactiveVar();
    var authCode = new ReactiveVar();

    Template.signup_sendmoney.helpers({
        watsiChecked : function(){
            return (sendTo.get() == 'watsi') ? "checked" : "";
        },
        stripeChecked : function(){
            return (sendTo.get() == 'stripe') ? "checked" : "";
        },
        cardFee : function(){
            var amount = 100;
            var user = Meteor.user();
            if(user) amount = user.amount * 100;
            var fee = wrteFee(amount) + stripeFee(amount, false);
            return (fee * 0.01).toFixed(2);
        },
        bitcoinFee : function(){
            var amount = 100;
            var user = Meteor.user();
            if(user) amount = user.amount * 100;
            var fee = wrteFee(amount) + stripeFee(amount, true);
            return (fee * 0.01).toFixed(2);
        },
        stripeUrl : function(){
            return stripeAuthUrl("signup/sendmoney");
        },
        authCode : function(){
            return authCode.get();
        }
    });

    Template.signup_sendmoney.events({
        'click #btn_complete' : function(e){
            e.preventDefault();
            loading.set(true);
            Meteor.call("sendmoney", sendTo.get(), authCode.get(), function(err, result){
                loading.set(false);
                authCode.set();
                sendTo.set();
                if(err){
                    lastError.set(err.error);
                    return;
                }
                Router.go('/signup/done');
            });
        },
        'change input:radio[name=sendto]:checked' : function(e){
            var value = e.currentTarget.value;
            sendTo.set(value);
            if(value == 'watsi') {
                authCode.set("");
            }
        }
    });

    loading = new ReactiveVar(false);
    Router.route('/signup', function(){
        this.render("signup");
    })
    Router.route('/signup/done', function(){
        this.render("signup_done");
    });
    Router.route('/signup/sendmoney', function(){
        this.wait(Meteor.subscribe('me'));
        if(this.ready()){
            var user = Meteor.user();
            var code = this.params.query.code;
            if(code) {
                authCode.set(code);
                Router.go("/signup/sendmoney");
            }
            if(!sendTo.get()){
                if(authCode.get() || _.get(user, "services.stripe.stripe_publishable_key")){
                    sendTo.set("stripe");
                } else {
                    sendTo.set("watsi");
                }
            }
        }
        this.render("signup_sendmoney");
    });

    Tracker.autorun(function(){
        var user = Meteor.user();
        if(popup.get() == "login_link_opened" && user) {
            if(!_.get(user, "services.stripe")) {
                Router.go("/signup/sendmoney");
            } else {
                Router.go('/dashboard');
            }
            return;
        }
    });
}

Accounts.config({
    //sendVerificationEmail : true,
forbidClientAccountCreation : true,
});


