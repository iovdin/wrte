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

    this.render("dashboard_settings", { data : _.extend({
            username : function() {
                return Meteor.user().username;
            },
            email : function() {
                var user = Meteor.user();
                return _.get(user, "emails.0.address"); 
            }}, signupHelpers) 
    });
});

Router.route('/dashboard/transactions', function() {
    this.wait(Meteor.subscribe('invoices'));
    if(!this.ready()) {
        this.render("loading");
        return;
    } 
    amount.set(Meteor.user().amount);

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


//console.log("minAmount")
var amount = new ReactiveVar(minAmount);
signupEvents = {
    "input #amount" : function(event){
        var amountText = event.currentTarget.textContent;
        var lamount;
        if(!amountText) {
            lamount = minAmount;
        } else {
            lamount = parseFloat(amountText);
        }
        validateAmount(lamount);
        amount.set(lamount);
    },
}

Template.dashboard_settings.events(_.extend({
}, signupEvents));


Template.dashboard_topbar.events({
    'click #logout' : function(e){
        Meteor.logout();
    }
});
