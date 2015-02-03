
Npm.depends({
    'body-parser' : '1.11.0',
    'url' : '0.10.2'
});

Package.on_use(function (api, where) {
  //api.use('accounts-twitter', 'server');
  //api.use('oauth1', 'server');

  if(api.export){
      api.export('bodyParser', 'server')
      api.export('url', 'server')
  } 

  api.add_files(['body-parser.js'], 'server');
});
