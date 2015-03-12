stripeTest = true;
stripeUrl = "https://connect.stripe.com";

invoices = new Mongo.Collection("Invoice");

if(Meteor.isClient){
    popup = new ReactiveVar("");
}
