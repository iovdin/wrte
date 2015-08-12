stripeTest = (Meteor.absoluteUrl().indexOf("http://localhost") == 0);
//FIXME:
btcTest = (Meteor.absoluteUrl().indexOf("http://localhost") == 0); 
stripeUrl = "https://connect.stripe.com";

invoices = new Mongo.Collection("Invoice");

if(Meteor.isClient){
    popup = new ReactiveVar("");
}
