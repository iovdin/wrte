if (Meteor.isClient) {
    subscribeStatus = new ReactiveVar("intro");
    registredEmail = new ReactiveVar("");

    Template.intro.events({    
        "click #getEmail" : function(event){
            event.preventDefault();
            location.href="/#/signup"
        }
    });
    Template.signup_done.events({
        "click  #linkToHow" : function(event){
            event.preventDefault();
            location.href="/#/howitworks";
        }
    });

    var routes = {
        '/': function(){
            subscribeStatus.set("intro");
        },
        '/signup': function(){
            subscribeStatus.set("signup");
        },
        '/howitworks': function(){
            subscribeStatus.set("how");
        },
        '/signup_done': function(){
            subscribeStatus.set("signup_done");
        }
    };

    var router = Router(routes);

    router.init();



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
