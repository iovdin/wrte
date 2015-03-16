Meteor.startup(function () {
    Meteor.publish("invoices", function(){
        if(!this.userId) return [];
        return invoices.find({ userId : this.userId}, {sort : {createdAt : -1}});
    });
});
