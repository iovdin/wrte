if (Meteor.isClient) {
    lastError = new ReactiveVar();
    Meteor.startup(function () {
        Meteor.subscribe("me");
        // code to run on server at startup
    });

    Template.intro.events({    
        "click #getEmail" : function(event){
            event.preventDefault();
            Router.go("/signup")
        }
    });

    Template.topBar.helpers({
        'loggedIn' : function(){
            return Meteor.userId();
        }
    })

    Router.configure({
        layoutTemplate: 'MainLayout'
    });

    Router.onBeforeAction(function(){
        if(popup.get()) {
            this.render(popup.get(), { to : "popup"});
        } 
        this.next();

    });

    Tracker.autorun(function(){
        var router = Router.current(); 
        if(!router) return;
        var hash = router.location.get().hash; 
        if(hash.length > 1) {
            popup.set(hash.substr(1));
        } else {
            popup.set("empty");
        }
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
