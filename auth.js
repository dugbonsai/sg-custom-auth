var express      = require('express'),
    passport     = require('passport'),
    bodyParser   = require('body-parser'),
    LdapStrategy = require('passport-ldapauth'),
    curl         = require('curl-request');

// !!! Replace localhost with Sync Gateway hostname
var syncGatewayEndpoint = 'http://localhost:4985/travel-sample';
var app = express();
var OPTS = {
  server: {
// !!! Replace localhost with OpenLDAP server hostname
    url: 'ldap://localhost:389',
    searchBase: 'dc=example,dc=com',
    searchFilter: '(uid={{username}})'
  }
};

passport.use(new LdapStrategy(OPTS));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(passport.initialize());

app.post('/login', passport.authenticate('ldapauth', {session: false}), function(req, res) {
  // user successfully authenticated against OpenLDAP server
  console.log("%s has been authenticated with LDAP", req.body.username);
  resBody = {statusCode: 200};

  // check to see if user exists in Sync Gateway
  // GET sg/{{db}}/_user/{{username}}
  getUser = new(curl);
  getUser.setHeaders(['Content-Type: application/json'])
  .get(syncGatewayEndpoint + '/_user/' + req.body.username)
  .then(({statusCode, body, headers}) => {
    if (statusCode == 404) {
      // status == 404: user does not exist
      console.log("creating user %s in Sync Gateway", req.body.username);

      // create user in Sync Gateway
      // POST sg/{{db}}/_user/
      postUser = new(curl);
      postUser.setHeaders(['Content-Type: application/json'])
      .setBody('{"name": "' + req.body.username + '","password": "' + req.body.password + '"}')
      .post(syncGatewayEndpoint + '/_user/')
      .then(({statusCode, body, headers}) => {
        if (statusCode == 201) {
          // status == 201: success
          console.log("user %s created in Sync Gateway", req.body.username);

          // create session for user & send response back to client
          createSession(req, res, resBody);
        } else {
          // user could not be created
          console.log("error creating user %s in Sync Gateway", req.body.username, statusCode, body, headers)
          resBody.statusCode = statusCode;
          resBody.message = "error creating user " + req.body.username + " in Sync Gateway";

          // send error response back to client
          res.send(JSON.stringify(resBody));
        }
      })
      .catch((e) => { console.log(e); });
    } else if (statusCode == 200) {
      console.log("user %s exists in Sync Gateway", req.body.username);

      // create session for user & send response back to client
      createSession(req, res, resBody);
    }
  })
  .catch((e) => { console.log(e); });
});

console.log("listening on port 8080");
app.listen(8080);

function createSession(request, response, resBody) {
  // create session for user
  // POST sg/{{db}}/_session
  console.log("create session for user %s", request.body.username);
  postSession = new(curl);
  postSession.setHeaders(['Content-Type: application/json'])
  .setBody('{"name": "' + request.body.username + '","ttl": 1800}')
  .post(syncGatewayEndpoint + '/_session')
  .then(({statusCode, body, headers}) => {
    if (statusCode == 200) {
      // status == 200: success
      console.log("created session for %s", request.body.username);

      // response contains following values
      // "session_id": "560ac85a8cd2de4255387468d6c64f7141f1d344",
      // "expires": "2019-07-29T03:56:27.208615962Z",
      // "cookie_name": "SyncGatewaySession"
      resBody.session_id = body.session_id;
      resBody.expires = body.expires;
      resBody.cookie_name = body.cookie_name;

      // send success response back to client
      response.send(JSON.stringify(resBody));
    }
    else {
      console.log("unable to create session for %s", request.body.username);
      resBody.statusCode = statusCode;
      resBody.message = "unable to create session for " + request.body.username;

      // send error response back to client
      response.send(JSON.stringify(resBody));
    }
  })
  .catch((e) => { console.log(e); });
}
