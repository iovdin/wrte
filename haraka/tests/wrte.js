'use strict';

process.env.HARAKA = process.env.PWD;

var _              = require('underscore');
var SMTPConnection = require('smtp-connection');
var SMTPServer     = require('smtp-server').SMTPServer;
var MongoClient    = require('mongodb').MongoClient;
var MailParser     = require("mailparser").MailParser;
var events         = require('events');
var util           = require("util");
var bitcore        = require("bitcore");
var Insight        = require('bitcore-explorers').Insight;

/*_.mixin({
  series: function() {
      var runs = 0;
      var results = [];
      var functions = _.filter(arguments, _.isFunction); 
      var len = functions.length;
      var self = this;
      return function() {
          if(runs >= len) {
              return results[len - 1];
          }
          results[runs] = functions[runs].apply(self, arguments);
          runs++;
          return results[runs-1];
      }
  }
});*/

process.on('uncaughtException', function(err) {
    console.error(err.stack);
});


var setUpMail = function(done){
    this.clientOptions = { port : 25, host : "127.0.0.1" , name : 'wrte.test', secure : false, debug : true, ignoreTLS: true };
    var client = this.client = new SMTPConnection(this.clientOptions);

    client.send = _.wrap(client.send, function(func){
        var args1 = Array.prototype.slice.call(arguments, 1);
        client.connect(function(){
            func.apply(client, args1)
        });
    })
    this.client.on('log', function(text){
        console.log(text.type + ": " + text.message);
    });
    this.server = new SMTPServer({
        secure : false,
        name : "wrte.test",
        disabledCommands : ['AUTH', 'STARTTLS']
    });

    this.e = new events.EventEmitter();
    var self = this;
    this.server.onMailFrom = function(address, session, callback) {
        self.e.emit('mail_from', address);
        setImmediate(callback);
    }
    this.server.onRcptTo = function(address, session, callback){
        //console.log("onRcptTo");
        self.e.emit('rcpt_to', address);
        setImmediate(callback);
    }
    this.server.onData = function(stream, session, callback) {
        self.mailparser = new MailParser();
        self.mailparser.on("end", function(mail){
            self.e.emit("message", mail, callback);
            setImmediate(callback);
        });
        stream.pipe(self.mailparser);
    }

    this.server.listen(2500, "127.0.0.1", function(){
        done();
    });

}

var tearDownMail = function(done){
    //console.log("tearDown");
    this.client.close();
    this.server.server.on('close', function(){
        done();
    });
    this.server.close();
}

var setUpMongo = function(done){
    var dbURL = "mongodb://127.0.0.1:3001/meteor"

    var self = this;
    MongoClient.connect(dbURL, function(err, db) {
        if(err) {
            inst.logerror("failed to connect mongodb " + dbURL + " " + JSON.stringify(err));
            console.log(("failed to connect mongodb " + dbURL + " " + JSON.stringify(err)));
        }
        self.db = db;
        self.users = db.collection('users');
        self.invoices = db.collection('Invoice');
        done();
    });
}

var genID = function(){
    return _.uniqueId(String(_.now() + "_"));
}
var tearDownMongo = function(done){
    this.db.close();
    done();
}
exports.special_emails = {
    setUp : function(done){
        setUpMail.call(this, done);
    },
    tearDown : function(done){
        tearDownMail.call(this, done);
    },
    'should accept emails on @test domain' : function(test){
        test.expect(4);
        var one = genID() + "@test";
        var two = genID() + "@test";
        var client = this.client;
        client.send({ from : one, to: two}, "Hello world", function(err, info){
            test.ok(!err, "no error returned");
            test.equals(1, info.accepted.length);
            client.quit();
        });
        this.server.onMailFrom = function(address, session, callback) {
            //console.log("onMailFrom");
            test.equals(address.address, one);
            setImmediate(callback);
        }
        this.server.onRcptTo = function(address, session, callback){
            //console.log("onRcptTo");
            test.equals(address.address, two);
            test.done();
            setImmediate(callback);
        }
    },
    'should delivery@write.io -> delivery@test' : function(test){
        var client = this.client;
        var from = "return-path@test";
        var to = "delivery@wrte.io";
        client.send({ from : from, to: to}, "Subject: Test\nHello world", function(err, info){
            test.ok(!err, "no error returned");
            test.equals(info.accepted.length, 1);
        });
        this.server.onRcptTo = function(address, session, callback){
            test.equals(address.address, "delivery@test");
            test.done();
            setImmediate(callback);
        }
    },
    'should support@write.io -> support@test & support2@test' : function(test){
        test.expect(4);
        var client = this.client;
        var from = "return-path@test";
        var to = "support@wrte.io";
        client.send({ from : from, to: to}, "Subject: Test\nHello world", function(err, info){
            test.ok(!err, "no error returned");
            test.equals(info.accepted.length, 1);
            client.quit();
        });
        this.e.on('rcpt_to', _.once(function(address){
            test.equals(address.address, "support@test");
        }));
        this.e.on('rcpt_to', _.after(2, function(address){
            test.equals(address.address, "support2@test");
            test.done();
        }));
    }
}

exports.auth = {
    setUp : function(done){
        this.clientOptions = { port : 25, host : "127.0.0.1" , name : 'wrte.test', secure : false, debug : true, ignoreTLS: true };
        var client = this.client = new SMTPConnection(this.clientOptions);
        this.client.on('log', function(text){
            console.log(text.type + ": " + text.message);
        });
        this.server = new SMTPServer({
            secure : false,
            name : "wrte.test",
            disabledCommands : ['AUTH', 'STARTTLS']
        });
        this.server.listen(2500, "127.0.0.1", function(){
            done();
        });
    },
    tearDown : function(done){
        this.client.close();
        this.server.server.on('close', function(){
            done();
        });
        this.server.close();
    },
    //TODO: run not from 127.0.0.1
    /*'should reject email form wrte.io if not authenticated' : function(test){
        test.expect(2);
        var self = this;
        var from = genID() + "@wrte.io";
        var to = genID() + "@test";


        self.client.connect(function(){
            self.client.send({from : from , to : to}, "hello world", function(err, info){
                test.ok(err, 'has error');
                test.equals(err.responseCode, 550, 'response code is 550');
                self.client.quit();
                test.done();
            });
        });
    },*/
    'should pass email from wrte.io if authenticated': function(test){
        test.expect(4);
        var self = this;
        var from = genID() + "@wrte.io";
        var to = genID() + "@test";
        self.client.connect(function(){
            self.client.login({user : "wrte", pass : "es3KWvzzVE0K" }, function(err, result){
                test.ok(result, 'authenticated');
                self.client.send({ from : from , to : to }, "hello world", function(err, info){
                    test.ok(!err, 'no error occured');
                    self.client.quit();
                });
            });
        });

        var testDone = _.once(function(){
            test.done();
        });

        this.server.onMailFrom = function(address, session, callback) {
            test.equals(address.address, from);
            setImmediate(callback);
        }
        this.server.onRcptTo = function(address, session, callback){
            test.equals(address.address, to);
            setImmediate(callback);
            testDone();
        };

        setTimeout(function(){
            testDone();
        }, 1000);
    }
}

exports.paid_delivery = {
    setUp : function(done){
        var self = this;
        this.username = genID();
        this.email    = genID() + "@test";
        this.from     = genID() + "@test";

        setUpMongo.call(self, function(){
            self.users.insert([{ username : self.username, _id : "test_" + self.username, emails : [ {address : self.email, verified : true}], price : 0.0001, amount : 1, currency : "usd", active : true, services : { stripe : { ref : "watsi"}} }], function(err, result){

                setUpMail.call(self, done);
            });
        });
    },
    tearDown : function(done){
        var self = this;
        self.users.remove([{username : self.username}], function(err, result){
            tearDownMongo.call(self, function(){
                tearDownMail.call(self, done);
            });
        })
    },
    'should reject non existent user' : function(test){
        test.expect(2);
        var client = this.client;
        var from = genID() + "@test";
        var to = genID() + "@wrte.io";
        client.send({ from : from, to: to}, "Subject: Test\nHello world", function(err, info){
            test.ok(err, "error returned");
            test.equals(err.responseCode, 550);
            client.quit();
            test.done();
        });
    }, 
    'should send an invoice and stop if not opened' : function(test){
        //TODO:
        test.done();
    },
    'should send an invoice and fail if not paid' : function(test){
        test.expect(9);
        var self = this;
        var client = this.client;
        client.send({ from : self.from, to: self.username + "@wrte.io"}, "Subject: Test\nHello world", function(err, info){
            test.ok(!err, "no error on sending");
            self.client.quit();
        });

        this.e.on('mail_from', function(address){
            console.log("mail_from", address.address);
            test.equals(address.address, "delivery@wrte.io");
        });

        this.e.on('rcpt_to', function(address){
            console.log("rcpt_to", address.address);
            test.equals(address.address, self.from);
        });

        this.e.on('message', _.once(function(mail){
            var headers = mail.headers;
            console.log("headers1", headers);
            self.invoice = headers['x-test-invoice'];
            test.ok(self.invoice);
            test.equals(headers['x-test-mail'], "invoice-charity");
            self.invoices.update({ _id : self.invoice } , 
                { $set: { status : 'opened' } }, 
                function(err, result) {
                    //console.log("updated invoice");
                });
        }));

        this.e.on('message', _.after(2, function(mail) {
            var headers = mail.headers;
            console.log("headers2", headers);
            test.equals(headers['x-test-invoice'], self.invoice);
            test.equals(headers['x-test-mail'], "fail");
            test.done();
        }));
        setTimeout(function(){
            test.done();
        }, 3000);

    },
    'should send an invoice and succeed when paid' : function(test) {
        test.expect(13);
        var client = this.client;
        var self = this;
        self.msg = genID();
        var msg = [
            "Subject: Test",
            "x-test-message: " + self.msg,
            "Hello world" ].join("\r\n");

        client.send({ from : self.from, to: self.username + "@wrte.io"}, msg, function(err, info){
            test.ok(!err, "no error on sending");
            client.quit();
        });

        //got invoice
        this.e.on("rcpt_to", _.once(function(address){
            test.equals(address.address, self.from);
            console.log("rcpt_to", address.address);
        }))
        this.e.on("mail_from", _.once(function(address){
            test.equals(address.address, "delivery@wrte.io");
            console.log("mail_from", address.address);
        }))

        this.e.on('message', _.once(function(mail){
            var headers = mail.headers;
            console.log("headers", headers);
            self.invoice = headers['x-test-invoice'];
            test.equals(headers['x-test-mail'], "invoice-charity");
            self.invoices.update({ _id : self.invoice } , { $set: { status : 'paid' } }, function(err, result) {

            });
        }));

        //got email
        this.e.on("rcpt_to", _.after(2, _.once(function(address){
            test.equals(address.address, self.email);
            console.log("rcpt_to", address.address);
        })));
        this.e.on("mail_from", _.after(2, _.once(function(address){
            test.equals(address.address, self.from);
            console.log("mail_from", address.address);
        })));

        this.e.on('message', _.after(2, _.once(function(mail){
            var headers = mail.headers;
            console.log("headers2", headers);
            self.invoice = headers['x-test-invoice'];
            var msg = headers['x-test-message'];
            test.ok(msg, "message id is not empty");
            test.equals(msg, self.msg);
        })));

        //got confirmation
        this.e.on("rcpt_to", _.after(3, function(address){
            test.equals(address.address, self.from);
            console.log("rcpt_to", address.address);
        }))
        this.e.on("mail_from", _.after(3, function(address){
            test.equals(address.address, "delivery@wrte.io");
            console.log("mail_from", address.address);
        }))

        this.e.on('message', _.after(3, function(mail){
            var headers = mail.headers;
            console.log("headers3", headers);
            self.invoice = headers['x-test-invoice'];
            test.equals(headers['x-test-mail'], "delivered");

            //verify it has changed status to "delivered"
            self.invoices.findOne({ _id : self.invoice } , function(err, result) {
                test.ok(!err, "cant find invoice ", self.invoice);
                test.equals(result.status, "delivered");
                test.done();
            });
        }));

        setTimeout(function(){
            test.done();
        }, 3000);
    }
}

exports.free_delivery = {
    setUp : function(done){
        var self = this;
        this.username = genID();
        this.email    = genID() + "@test";
        this.from     = genID() + "@test";

        setUpMongo.call(self, function(){
            self.users.insert([{ username : self.username, active : true, _id : "test_" + self.username, emails : [ {address : self.email, verified : true}], price : 0.0001, amount : 0, currency : "usd" }], function(err, result){

                setUpMail.call(self, done);
            });
        });
    },
    tearDown : function(done){
        var self = this;
        self.users.remove([{username : self.username}], function(err, result){
            tearDownMongo.call(self, function(){
                tearDownMail.call(self, done);
            });
        })
    },
    'should pass email if amount is 0' : function(test) {
        test.expect(3);
        var client = this.client;
        var self = this;
        self.msg = genID();
        var msg = [
            "Subject: Test",
            "x-test-message: " + self.msg,
            "Hello world" ].join("\r\n");

        client.send({ from : self.from, to: self.username + "@wrte.io"}, msg, function(err, info){
            test.ok(!err, "no error on sending");
            client.quit();
        });

        //got email
        this.e.on("rcpt_to", function(address){
            test.equals(address.address, self.email);
            console.log("rcpt_to", address.address);
        });
        this.e.on("mail_from", function(address){
            test.equals(address.address, self.from);
            console.log("mail_from", address.address);
        });

        setTimeout(function(){
            test.done();
        }, 3000);
    },
    'should pass email from whitelist' : function(test) {
        test.expect(3);
        var client = this.client;
        var self = this;
        self.from = genID() + "@bounce.linkedin.com";
        self.msg = genID();
        var msg = [
            "Subject: Test",
            "x-test-message: " + self.msg,
            "Hello world" ].join("\r\n");

        client.send({ from : self.from, to: self.username + "@wrte.io"}, msg, function(err, info){
            test.ok(!err, "no error on sending");
            client.quit();
        });

        //got email
        this.e.on("rcpt_to", function(address){
            test.equals(address.address, self.email);
            console.log("rcpt_to", address.address);
        });
        this.e.on("mail_from", function(address){
            test.equals(address.address, self.from);
            console.log("mail_from", address.address);
        });

        setTimeout(function(){
            test.done();
        }, 3000);
    }
}

function spendBitcoins(test, toAddress, amount, callback){
        //console.log("spend address type", typeof(address), amount)
        var transaction = new bitcore.Transaction().from(test.utxos).to(toAddress, amount).change(test.privateKey.toAddress()).sign(test.privateKey);
        //var insight = new Insight("https://test-insight.bitpay.com");
        test.insight.broadcast(transaction, callback);
        return transaction;

}
exports.bitcoin_delivery = {
    setUp : function(done){
        var self = this;
        this.username = genID();
        this.email    = genID() + "@test";
        this.from     = genID() + "@test";
        //this.privateKey = new bitcore.PrivateKey(null, bitcore.Networks.testnet);
        //testnet
        this.privateKey = bitcore.PrivateKey.fromWIF("cPJuhtfYgVaYDRmMQ1GU4PpYFUfzg9MBdMMxLBQXL3dLqmVE9sG1");
        //public address "mnM6aRDB38BzngW99M14u3JafvWj7ZSvvo"
        

        //livenet
        //this.privateKey = bitcore.PrivateKey.fromWIF("L4LShBYPNTpryeC84RFWMHpxsjsimD7i8R5FuZbcLp7tid1acQaq");
        
        //got some bitcoins for test net http://tpfaucet.appspot.com
        //and return them back 
        //var address = "msj42CCGruhRsFrGATiUuh25dtxYtnpbTx";
        
        //console.log("address ", this.privateKey.toAddress().toString());
        //our second address
        var address = this.address = "mt8iAU3pLCpfxzXDCfhY98Tqcc7KWVMKWC";

        setUpMongo.call(self, function(){
            self.users.insert([{ username : self.username, active : true, _id : "test_" + self.username, emails : [ {address : self.email, verified : true}], amount : 0.01, currency : "usd", services : { btc : { address : address }} }], function(err, result){

                self.insight = new Insight("https://test-insight.bitpay.com");
                self.insight.getUnspentUtxos(self.privateKey.toAddress().toString(), function(err, utxos) {
                    if(!err) {
                        self.utxos = utxos
                        setUpMail.call(self, done);
                    }
                });
            });
        });
    },
    tearDown : function(done){
        var self = this;
        self.users.remove([{username : self.username}], function(err, result){
            tearDownMongo.call(self, function(){
                tearDownMail.call(self, done);
            });
        });

        if(self.invoice) 
            self.invoices.remove([{_id : self.invoice._id}]);
    },
    'invoice should be paid' : function(test){
        var client = this.client;
        var self = this;
        test.expect(10);

        self.msg = genID();
        var msg = [
            "Subject: Test",
            "x-test-message: " + self.msg,
            "Hello world" ].join("\r\n");

        client.send({ from : self.from, to: self.username + "@wrte.io"}, msg, function(err, info){
            test.ok(!err, "no error on sending");
            self.client.quit();
        });

        this.e.on('mail_from', _.once(function(address){
            console.log("mail_from", address.address);
            test.equals(address.address, "delivery@wrte.io");
        }));

        this.e.on('rcpt_to', _.once(function(address){
            console.log("rcpt_to", address.address);
            test.equals(address.address, self.from);
        }));

        this.e.on('message', _.once(function(mail){
            var headers = mail.headers;
            console.log("headers1", headers);
            self.invoice = headers['x-test-invoice'];
            test.ok(self.invoice);
            test.equals(headers['x-test-mail'], "invoice");
            self.invoices.update({ _id : self.invoice } , 
                { $set: { status : 'opened' } }, 
                function(err, result) {
                    //console.log("updated invoice");
                });
            self.invoices.findOne({ _id : self.invoice } , function(err, result) {
                test.ok(!err, "cant find invoice ", self.invoice);
                var amount = Math.round(result.btc.amount * 1e8);
                console.log("invoice to", result.btc.address, amount);
                var t = spendBitcoins(self, result.btc.address, amount, function(err, transaction){
                    test.ok(!err, "cant broadcast transaction");
                    console.log("transaction id", transaction);
                });
                //test.equals(result.status, "delivered");
            });
        }));


        this.e.on("rcpt_to", _.after(2, _.once(function(address){
            test.equals(address.address, self.email);
            console.log("rcpt_to", address.address);
        })));
        this.e.on("mail_from", _.after(2, _.once(function(address){
            test.equals(address.address, self.from);
            console.log("mail_from", address.address);
        })));

        this.e.on('message', _.after(2, _.once(function(mail){
            var headers = mail.headers;
            console.log("headers2", headers);
            self.invoice = headers['x-test-invoice'];
            var msg = headers['x-test-message'];
            test.ok(msg, "message id is not empty");
            //test.equals(msg, self.msg);
        })));

        setTimeout(function(){
            test.done();
        }, 7000);
    }
}
