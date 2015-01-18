if (Meteor.isClient) {
    
    _.chain(this).pairs().filter(function(pair){
        return (pair[1] instanceof ReactiveVar);
    }).each(function(pair){
        Template.registerHelper(pair[0], function(){
            return pair[1].get();
        });
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
