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
    Router.route('/', function(){
        this.render("intro");
    });
    Router.route('/howitworks', function(){
        this.render('howitworks');
    });

    /*var routes = {
        '/': function(){
            main.set("subscribe");
            subscribeStatus.set("intro");
        },
        '/signup': function(){
            main.set("subscribe");
            subscribeStatus.set("signup");
        },
        '/howitworks': function(){
            main.set("subscribe");
            subscribeStatus.set("how");
        },
        '/signup_done': function(){
            main.set("subscribe");
            subscribeStatus.set("signup_done");
        },
        '/invoice/:id': function(id) {
            main.set("invoice");
            invoiceStatus.set("create");
            //var url = parseUri(window.location.href)
            HTTP.get("/btc/create", {params : {id : id} }, function(err, result){
                if(err){
                    console.log(err);
                    invoiceStatus.set("error");
                    return;
                }
                console.log(result);
                var data = JSON.parse(result.content);
                switch(data.status){
                    case "created":
                        buttonId.set(data.button);
                        invoiceStatus.set("created");
                        break;
                    case "timeout1":
                    case "timeout2":
                        invoiceStatus.set("timeout");
                        break;
                    case "paid":
                        invoiceStatus.set("paid");
                        break;
                }
            });
        }
    };

    var router = new Router(routes);
    //router.configure({html5history: true});
    router.init();*/

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
