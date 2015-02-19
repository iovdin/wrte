if (Meteor.isServer){
    Router.route("/allusers", function(){
        var emails = Meteor.users.find({}, { fields : {username : 1, "emails.address" : 1 }}).map(function(user){
            return [user.username, user.emails[0].address]
        });
        var text = _.chain(emails).map(function(email, index){
            return (index+1) + ". " + email[0] + "@wrte.io -> " + email[1];
        }).value().join("\n");
        var allusersTemplate = _.template(Assets.getText("email_templates/allusers.txt"));
        var content = allusersTemplate({emails : text})

        Email.send({
            to : "support@wrte.io",
            from : "Wrte <support@wrte.io>",
            subject : "all registered users",
            text : content,
        });
        this.response.writeHead(200);
        this.response.end("done");
    }, { where : "server"});
}
