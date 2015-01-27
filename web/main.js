if (Meteor.isClient) {
    
    _.chain(this).pairs().filter(function(pair){
        return (pair[1] instanceof ReactiveVar);
    }).each(function(pair){
        Template.registerHelper(pair[0], function(){
            return pair[1].get();
        });
    });

    Template.registerHelper("case", function(){
        var pair =_.chain(this).pairs().first().value();
        //console.log("case pair", pair);
        var rvar = window[pair[0]];
        if(!rvar){
            //console.log("create var ", pair[0]);
            rvar = window[pair[0]] = new ReactiveVar("default");
        }
        if(rvar instanceof ReactiveVar && rvar.get().toString() == pair[1]) {
            return Template._case_default;
        }
        return null;
    });
    
    subscribeStatus = new ReactiveVar("intro");
    registredEmail = new ReactiveVar("");
    
    Template.registerHelper("subscribeStage", function() {
        return subscribeStatus.get()
    });
    Template.registerHelper("registredEmail", function() {
        return registredEmail.get()
    });
    Template.registerHelper("errorMessage", function() {
        return lastError.get()
    });
    
    Template.intro.events({    
        "click #getEmail" : function(event){
            event.preventDefault();
            //console.log("input event started");
            subscribeStatus.set("signup")
         }
    });
    Template.signup_done.events({
        "click  #linkToHow" : function(event){
            event.preventDefault();
            subscribeStatus.set("how");
            //console.log("input event started");
        }
    });
    Template.topBar.events({    
        "click #linkToIntro" : function(event){
            event.preventDefault();
            //console.log("input event started");
            subscribeStatus.set("intro")
        },
        "click #linkToHow" : function(event){
            event.preventDefault();
            //console.log("input event started");
            subscribeStatus.set("how")
        }
    });

    /*function daysInInterval(from, to) {
        var count = 1;
        var counter = new Date(from.getTime());
        while(count < 1000 && !counter.equals(to)) {
            counter.setDate(counter.getDate() + 1);
            count++;
        }
        return count;
    }
    Date.prototype.equals = function(d){
        return this.getDate() == d.getDate() && this.getMonth() == d.getMonth() && this.getFullYear() == d.getFullYear()
    }

    var dates = [
        [ "08/08/2014", "09/02/2014" ],
        [ "11/03/2014", "11/19/2014" ],
        [ "11/23/2014", "01/08/2015" ]
        ];
    var total = 0;
    for(var i = 0; i < dates.length; i++){
        total += daysInInterval(new Date(dates[i][0]), new Date(dates[i][1]));
    }
    console.log("days in interval", total);*/

}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
    });
}
