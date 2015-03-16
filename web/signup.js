if (Meteor.isClient) {
    registredEmail = new ReactiveVar("");

    aliasValidateStatus = new ReactiveVar("default");
    validateAlias = inputValidator("is_alias_taken", aliasValidateStatus);

    emailValidateStatus = new ReactiveVar("default");
    validateEmail = inputValidator("is_email_taken", emailValidateStatus);

    amountValidateStatus = new ReactiveVar("default");
    validateAmount = _.debounce(function(amount){
        var isValid = isAmountValid(amount);
        console.log("isValid", isValid);
        amountValidateStatus.set(isValid);
    }, 500);
    resetValidators = function(){
        aliasValidateStatus.set("");
        emailValidateStatus.set("");
        amountValidateStatus.set("");
    }


    Template.signup.events(_.extend({
        "input #alias" : function(event){
            alias.set(event.currentTarget.textContent);
            validateAlias(alias.get()); 
            //console.log("alias validate status:", aliasValidateStatus);
        },
        "input #email" : function(event){
            email.set(event.currentTarget.textContent);
            validateEmail(email.get());
        },
        "click button" : function(event, template){
            event.preventDefault();

            Meteor.call("signup", alias.get(), email.get(), amount.get(), function(error, token){
                if (error){
                    var e = error.error;
                    lastError.set(error.error);
                    if(e.indexOf("amount_") >= 0) {
                        amountValidateStatus.set(e);
                    } else if(e.indexOf("email_") >= 0) {
                        emailValidateStatus.set(e);
                    } else if(e.indexOf("alias_") >= 0){
                        aliasValidateStatus.set(e);
                    }
                    return;
                }
                Meteor.loginWithEmailToken(token, function(error, result){
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
    }, signupEvents));

    amount = new ReactiveVar(minAmount);
    var alias = new ReactiveVar("");
    var email = new ReactiveVar("");
    var btcAddress = new ReactiveVar();
    var useOrCreate = "create";

    sendTo = new ReactiveVar();
    authCode = new ReactiveVar();

    signupHelpers = {
        minAmount : function(){
            return minAmount;
        },
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
    }

    Template.signup_sendmoney.helpers(signupHelpers);
    Template.signup.helpers(signupHelpers);

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


