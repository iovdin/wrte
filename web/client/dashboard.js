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
var sendTo = new ReactiveVar("watsi");

Router.route('/dashboard', function(){
    Router.go("/dashboard/settings");
});

var code;
Router.route('/dashboard/settings', function(){
    this.wait(Meteor.subscribe('me'));

    code = code || this.params.query.code;
    if(!this.ready()) {
        this.render("loading");
        return;
    }
    var user = Meteor.user();
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
var authCode = new ReactiveVar();
var btcAddress = new ReactiveVar("");
var gettingAddress = new ReactiveVar(false);


Template.dashboard_settings.rendered = function(){
    this.$("#amount").text(getAmount());
    var addr = btcAddress.get() || _.get(Meteor.user(), "services.btc.address")
    if(addr == watsiAddress)
        addr = ""
    btcAddress.set(addr)
    var self = this; 
    self.$("#btcAddress").text(addr);
    if(addr) sendTo.set("btc");

    if(code) {
        gettingAddress.set(true);
        sendTo.set("btc");
        Meteor.call("getWalletAddress", code, "dashboard/settings", function(err, result){
            console.log("getWalletAddress", err, result);
            if(result) {
                btcAddress.set(result);
                self.$("#btcAddress").text(btcAddress.get());
                validateBtcAddress(result);
            }
            gettingAddress.set(false);
        });
        Router.go("/dashboard/settings");
    }
}

Template.dashboard_settings.helpers({
    username : function() {
        return Meteor.user().username;
    },
    email : function() {
        var user = Meteor.user();
        return _.get(user, "emails.0.address"); 
    },
    authCode : function() {
        return authCode.get();
    },
    active : function(){
        return !!Meteor.user().active;
    },
    notactive : function(){
        return !Meteor.user().active;
    },
    notverified : function(){
        return !_.get(Meteor.user(), "emails.0.verified");
    },
    /*btcAddress : function() {
        var result = btcAddress.get() || _.get(Meteor.user(), "services.btc.address"); 
        if(result == watsiAddress) return "";
        return result;
    },*/
    gettingAddress : function(){
        return gettingAddress.get();
    },
    watsiChecked : function(){
        if(gettingAddress.get()) return "";
        return (sendTo.get() == 'watsi' || btcAddress.get() == watsiAddress ) ? "checked" : "";
    },
    btcChecked : function(){
        if(gettingAddress.get()) return "checked";
        return (sendTo.get() == 'btc' && btcAddress.get() != watsiAddress ) ? "checked" : "";
    },

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
    "input #btcAddress" : function(event){
        btcAddress.set(event.currentTarget.textContent);
        console.log("input change", btcAddress.get());
        validateBtcAddress(btcAddress.get());
    },
    'click #coinbase' : function(e) {
        location.href = coinbaseAuthUrl("dashboard/settings");
    },
    'click #save' : function(e){
        //save
        console.log("save");
        e.preventDefault();
        var options = {}
        if(amount.get() && amount.get() != Meteor.user().amount) {
            console.log("amount changed");
            options.amount = amount.get();
        }
        //options.authCode = authCode.get();
        options.btcAddress = btcAddress.get()
        options.sendTo = sendTo.get();

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
    'click #resend' : function(e){
        e.preventDefault();
        Meteor.call("send_verification", "dashboard/settings", function(err, result){
            console.log("verification sent", err, result);
        });
    },
    'change input:radio[name=sendto]:checked' : function(e){
        var value = e.currentTarget.value;
        sendTo.set(value);
    },
});

Template.dashboard_topbar.events({
    'click #logout' : function(e){
        Meteor.logout();
    }
});
