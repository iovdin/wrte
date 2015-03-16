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
    this.render("dashboard_settings");
});
Router.route('/dashboard/transactions', function(){
    this.wait(Meteor.subscribe('invoices'));
    if(!this.ready()) {
        this.render("loading");
    } else {
        this.render("dashboard_transactions", { data : {
            invoices : function(){
                return invoices.find().map(function(invoice){
                    invoice.createdAt = invoice.createdAt.toDateString();
                    console.log("createdAt", invoice.createdAt);
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
            }
        }});

    }
});

Template.dashboard_topbar.events({
    'click #logout' : function(e){
        Meteor.logout();
    }
});
