Meteor.startup(function () {
    Meteor.publish("invoices", function(){
        if(!this.userId) return [];
        return invoices.find({ userId : this.userId}, {sort : {createdAt : -1}});
    });


    Meteor.methods({
        removeUser : function(options){
            if(!Meteor.userId()){
                throw new Meteor.Error("not_authorized");
            }
            var user = Meteor.user();
            if(!_.get(Meteor.user(), "emails.0.verified")) {
                Meteor.users.remove({_id : Meteor.userId()});
                return;
            }

            if(options && options.token){
                var tokens = _.get(user, "services.removal.tokens");
                console.log("removeUser", options, tokens);
                if(tokens) {
                    for(var i = 0; i < tokens.length; i++){
                        if(tokens[i].token == options.token) {
                            Meteor.users.remove({_id : Meteor.userId()});
                            return;
                        }
                    }
                }

                throw new Meteor.Error("no_such_token");
            }

            var template = _.template(Assets.getText("email_templates/verify_removal.txt"));

            var email = _.get(user, "emails.0.address");
            var emailToken = Random.secret();

            Meteor.users.update({_id : user._id}, {$push : {'services.removal.tokens' : { token : emailToken, when : new Date()}}});

            Email.send({
                to : email,
                from : "wrte <support@wrte.io>",
                subject : "Please confirm account removal",
                text : template({email : user.username + "@wrte.io", link : Meteor.absoluteUrl('dashboard/settings?' + emailToken + "#remove_link_opened", {secure : true})}),
            });

            return;
        }});
});
