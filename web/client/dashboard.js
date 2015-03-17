Router.onBeforeAction(function(){
    var name = this.route.getName();
    if(name && name.indexOf("dashboard") == 0) {
        this.layout("DashboardLayout");
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
        return Meteor.user().username;
    },
    email : function() {
        var user = Meteor.user();
        return _.get(user, "emails.0.address"); 
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
            return result;
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
    'click button' : function(e){
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
                lastError.set(err.error);
                return;
            }
        });
    }
});

Template.dashboard_topbar.events({
    'click #logout' : function(e){
        Meteor.logout();
    }
});
