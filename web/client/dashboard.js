Router.onBeforeAction(function(){
    var name = this.route.getName();
    if(name && name.indexOf("dashboard") == 0) {
        this.layout("DashboardLayout");
        if(!Meteor.userId()) {
            Router.go("/#login");
            return;
        }
    }
    this.next();
});
Router.route('/dashboard', function(){
    Router.go("/dashboard/settings");
});

Router.route('/dashboard/settings', function(){
    this.wait(Meteor.subscribe('me'));

    if(!this.ready()) {
        this.render("loading");
        return;
    }
    var user = Meteor.user();
    var code = this.params.query.code;
    if(code) {
        authCode.set(code);
        Router.go("/dashboard/settings");
    }
    if(!sendTo.get()){
        if(authCode.get() || _.get(user, "services.stripe.stripe_publishable_key")){
            sendTo.set("stripe");
        } else {
            sendTo.set("watsi");
        }
    }
    this.render("dashboard_settings");
});
var getAmount = function() {
    if(amount.get())
        return amount.get();
    if(Meteor.user()) 
        return Meteor.user().amount;

    return minAmount
}

var amount = new ReactiveVar();
var sendTo = new ReactiveVar();
var authCode = new ReactiveVar();


Template.dashboard_settings.rendered = function(){
    this.$("#amount").text(getAmount());
}

Template.dashboard_settings.helpers({
    username : function() {
        return _.get(Meteor.user(),"username");
    },
    email : function() {
        return _.get(Meteor.user(), "emails.0.address"); 
    },
    cardFee : cardFee(getAmount),
    bitcoinFee : bitcoinFee(getAmount),
    watsiChecked : function(){
        return (sendTo.get() == 'watsi') ? "checked" : "";
    },
    stripeChecked : function(){
        return (sendTo.get() == 'stripe') ? "checked" : "";
    },
    stripeUrl : function(){
        return stripeAuthUrl("dashboard/settings");
    },
    authCode : function(){
        return authCode.get();
    },
    active : function(){
        return !!_.get(Meteor.user(), "active");
    },
    notactive : function(){
        return !_.get(Meteor.user(), "active");
    },
    notverified : function(){
        return !_.get(Meteor.user(), "emails.0.verified");
    }
});

Router.route('/dashboard/transactions', function() {
    this.wait(Meteor.subscribe('invoices'));
    if(!this.ready()) {
        this.render("loading");
        return;
    } 

    this.render("dashboard_transactions", { data : {
        invoices : function(){
            return invoices.find().map(function(invoice){
                invoice.createdAt = invoice.createdAt.toDateString();
                return invoice;
            });
        },
        total : function(){
            var result = 0;
            invoices.find().map(function(invoice){
                if(_.contains(["paid", "delivered"], invoice.status)) {
                    result += invoice.amount;
                }
            });
            return result.toFixed(2);
        },
        hasAny : function(){
            return invoices.findOne();
        }
    }});
});


Template.dashboard_settings.events({
    "input #amount" : amountChange(function(value){
        validateAmount(value);
        console.log("change amount", value);
        amount.set(value);
    }),
    'change input:radio[name=sendto]:checked' : function(e){
        var value = e.currentTarget.value;
        sendTo.set(value);
        if(value == 'watsi') {
            authCode.set("");
        }
    },
    'click #btn_save' : function(e){
        //save
        console.log("save");
        e.preventDefault();
        var options = {}
        if(amount.get() && amount.get() != Meteor.user().amount) {
            console.log("amount changed");
            options.amount = amount.get();
        }
        options.sendTo = sendTo.get();
        options.authCode = authCode.get();

        loading.set(true);
        Meteor.call("changeUser", options, function(err, result){
            loading.set(false);
            authCode.set();
            if(err){
                var e = err.error;
                console.log("error changing user", err);
                if(e.indexOf("amount_") >= 0) {
                    amountValidateStatus.set(e);
                }
                lastError.set(e);
                return;
            }
        });
    },
    'click #btn_remove' : function(e){
        e.preventDefault()
        goToHash("dashboard_confirm_remove");

    },
    'click #resend' : function(e){
        e.preventDefault();
        Meteor.call("send_verification", "dashboard/settings", function(err, result){
            console.log("verification sent", err, result);
        });
    }
});

userRemovalStatus = new ReactiveVar("");
Tracker.autorun(function(){
    if(popup.get() == "remove_link_opened" && Meteor.user()) {
        var router = Router.current();
        if(!router) return;
        var token = _.keys(Router.current().params.query)[0];
        var username = Meteor.user().username;
        userRemovalStatus.set("Removing account " + username + "@wrte.io");
        Meteor.call("removeUser", {token : token}, function(err, result){
            if(err){
                var e = err.error;
                lastError.set(e);
                userRemovalStatus.set("Failed to remove account");
                return;
            }

            userRemovalStatus.set("Account has been removed");
        })
    }})

Template.dashboard_removal_sent.events({
    'click button' : function(e){
        e.preventDefault();
        goToHash("");
    }
});

Template.dashboard_confirm_remove.events({
    'click #btn_yes': function(e){
        e.preventDefault();
        Meteor.call("removeUser", {}, function(err, result){
            if(err){
                var e = err.error;
                lastError.set(e);
                goToHash("");
                return;
            }
            goToHash("dashboard_removal_sent");
        });
    },
    'click #btn_no': function(e){
        e.preventDefault();
        goToHash("");


    }
});

Template.dashboard_topbar.events({
    'click #logout' : function(e){
        Meteor.logout();
    }
});
