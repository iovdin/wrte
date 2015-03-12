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

    popup = new ReactiveVar("");
    Router.onBeforeAction(function(){
        //depend on path otherwise Router.go does not work

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
            popup.set("");
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
