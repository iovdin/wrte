if (Meteor.isClient) {
    invoiceStatus = new ReactiveVar("");
    registredEmail = new ReactiveVar("");

    Template.intro.events({    
        "click #getEmail" : function(event){
            event.preventDefault();
            Router.go("/signup")
        }
    });

    Router.configure({
        layoutTemplate: 'MainLayout'
    });

    Router.onBeforeAction(function(){
        //depend on path otherwise Router.go does not work
        var path = Router.current().location.get().path;

        if(this.params.hash) {
            this.render(this.params.hash, { to : "popup"});
        }
        this.next();

    });

    Router.route('/', function(){
        this.render("intro");
    });
    Router.route('/howitworks', function(){
        this.render('howitworks');
    });

    // this lines has to be last lines in the file
    _.chain(this).pairs().filter(function(pair){
        return (pair[1] instanceof ReactiveVar);
    }).each(function(pair){
        Template.registerHelper(pair[0], function(){
            return pair[1].get();
        });
    });

}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
    });
}
