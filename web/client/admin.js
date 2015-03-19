Router.route("/admin/partner", function(){
    this.layout("AdminLayout");
    this.render("partner", {data : { link : partnerAuthLink.get() }});
});

Router.route("/admin/users", function(){
    this.wait(Meteor.subscribe('users'));
    if(!this.ready()) {
        this.render('loading');
        return;
    }
    this.layout("DashboardLayout");
    this.render("admin_users", { data : {
        users : function(){
            return Meteor.users.find({}, {sort : {createdAt : -1}}).map(function(user){
                return { _id : user._id, username : user.username, email : user.emails[0].address, active : user.active, verified : user.emails[0].verified, numSent : _.get(user, "services.email.numSent") || 0, date : user.createdAt.toDateString()};
            });
        }
    }})

})

partnerAuthLink = new ReactiveVar("");

Template.partner.events({
    "click button" : function(e){
        e.preventDefault();
        lastError.set("");
        Meteor.call("partner_invite", $("#email").text(), function(err, result){
            if(err){
                lastError.set(err.error);
            }
            if(result){
                partnerAuthLink.set(Meteor.absoluteUrl('stripe/partner?' + result, {secure : true}));
            }
        });
    }
});

Template.admin_users.events({
    "click button" : function(e){
        e.preventDefault();
        var btn = e.currentTarget;
        var action = btn.name;
        var userId = btn.value;
        console.log("click", action, userId);
        Meteor.call("admin_" + action, userId, function(err, result){
            console.log("admin_" + action, "done", err, result);
        });
    }
});
