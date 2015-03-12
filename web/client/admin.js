Router.route("/admin/partner", function(){
    this.layout("AdminLayout");
    this.render("partner", {data : { link : partnerAuthLink.get() }});
});

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
                partnerAuthLink.set(Meteor.absoluteUrl('stripe/partner?' + result));
            }
        });
    }
});
