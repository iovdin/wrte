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
    this.render("dashboard_transactions");
});
