'use strict';

var Address          = require('../../address').Address;
var Plugin           = require('../fixtures/stub_plugin');
var Connection       = require('../fixtures/stub_connection');

//returns hmail
var stub = function(plugin, queue_time, invoiceStatus) {
    var msgId = "1";
    plugin.invoices = { };
    plugin.invoices[msgId] = invoiceStatus;
    return { todo : {notes : { msgId : msgId }, queue_time : queue_time }};
}
var _set_up = function (done) {
    // needed for tests
    this.plugin = new Plugin('bitcoin');

    /*this.connection = Connection.createConnection();
    this.connection.loginfo = stub();
    this.connection.transaction = {
        notes: stub(),
        rcpt_to: [ this.params ],
    };

    // some test data
    this.configfile = {
        "test1" : { "action" : "drop" },
        "test2" : { "action" : "drop" },
        "test2-specific" : { "action" : "alias", "to" : "test2" },
        "test3" : { "action" : "alias", "to" : "test3-works" },
        "test4" : { "action" : "alias", "to" : "test4" },
        "test5" : { "action" : "alias", "to" : "test5-works@success.com" },
        "test6" : { "action" : "alias", "to" : "test6-works@success.com" },
        "test7" : { "action" : "fail",  "to" : "should_fail" },
        "test8" : { "to" : "should_fail" },
        "test9" : { "action" : "alias" }
    };

    this.plugin.config.get = function (file, type) {
        return this.configfile;
    }.bind(this);

    this.plugin.inherits = stub();

    // going to need these in multiple tests
    this.plugin.register();
*/
    done();
};
exports.delay = {
    setUp : _set_up,
    'delay should return true for paid invoice' : function(test){
        test.expect(2);
        var hmail = stub(this.plugin, (new Date()).getTime(), "paid");
        test.ok(this.plugin.delay(hmail));
        test.equal(hmail.todo.notes.status, "invoice_paid");
        test.done();
    },
    'delay should return true for mispaid invoice' : function(test){
        test.expect(2);
        var hmail = stub(this.plugin, new Date(), "mispaid");
        test.ok(this.plugin.delay(hmail));
        test.equal(hmail.todo.notes.status, "invoice_mispaid");
        test.done();
    },
    'delay should return for just created invoice after 10 minutes' : function(test){
        test.expect(4);
        var now = (new Date()).getTime();

        var hmail = stub(this.plugin, now, "created");
        test.ok(!this.plugin.delay(hmail));
        test.ok(!hmail.todo.notes.status);

        var hmail = stub(this.plugin, now - 11 * 60 * 1000 , "created");
        test.ok(this.plugin.delay(hmail));
        test.ok(!hmail.todo.notes.status);
        test.done();
    },
    'delay should return for opened invoice after 60 minutes' : function(test){
        test.expect(4);
        var now = (new Date()).getTime();

        var hmail = stub(this.plugin, now, "opened");
        test.ok(!this.plugin.delay(hmail));
        test.ok(!hmail.todo.notes.status);

        var hmail = stub(this.plugin, now - 61 * 60 * 1000 , "opened");
        test.ok(this.plugin.delay(hmail));
        test.ok(hmail.todo.notes.failReason);
        test.done();
    }
}
