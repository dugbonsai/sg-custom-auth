# sg-custom-auth
Code for [Custom Authentication with Couchabse Mobile blog article](https://blog.couchbase.com/custom-authentication-with-couchbase-mobile/).

**auth.js**
Node.js-based App Server to authenticate against and OpenLDAP server using the [passport-ldapauth package](https://www.npmjs.com/package/passport-ldapauth) for LDAP authentication.

**ldap_data.ldif**
Information to pupulate the OpenLDAP database. Contains a single user **mobileuser**.

The following code snippets highlight the call to the App Server and the Couchbase Lite code to authenticate using the session_id.
**Authenticate user with App Server by calling POST /login/**
JSONObject reqBody = new JSONObject();
reqBody.put("username", <user supplied username>);
reqBody.put("password", <user supplied password>);

String url = <App Server host>:8080/login;
RequestQueue queue = Volley.newRequestQueue(<context>);
JsonRequest<JSONObject> jsonRequest = new JsonObjectRequest(
     Request.Method.POST,
     url,
     reqBody,
     new Response.Listener<JSONObject>() {
          @Override
          public void onResponse(JSONObject response) {
               // get session_id from response
               try {
                    String sessionID = response.getString("session_id");
                    // Store session_id
               } catch (JSONException je) {
                    // Handle exception
               }
          }
     },
     new Response.ErrorListener() {
          @Override
          public void onErrorResponse(VolleyError error) {
               // authentication failed
          }
     });

queue.add(jsonRequest);

**Create one-shot replication**
Create one-shot replication using saved session_id and re-authenticate if Sync Gateway session has expired.
String syncGatewayEndpoint = "ws://<Sync Gateway Host>:4984/{database}";
URI url = null;
try {
     url = new URI(mSyncGatewayEndpoint);
} catch (URISyntaxException e) {
     e.printStackTrace();
     return;
}

ReplicatorConfiguration config = new ReplicatorConfiguration(database, new URLEndpoint(url));
config.setReplicatorType(ReplicatorConfiguration.ReplicatorType.PUSH_AND_PULL);
config.setContinuous(false);
config.setAuthenticator(new SessionAuthenticator(sessionID));

Replicator replicator = new Replicator(config);
replicator.addChangeListener(new ReplicatorChangeListener() {
     @Override
     public void changed(ReplicatorChange change) {
          CouchbaseLiteException error = change.getStatus().getError();            if (error != null) {
               if (error.getCode() == 10401) {                          
                    // session expired; re-authenticate
               }
          } 

          ...
     }
});
replicator.start();
