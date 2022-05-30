const express = require('express');
const expressSession = require('express-session');
const passport = require('passport');
const TequilaStrategy = require('passport-tequila').Strategy;

// Use the TequilaStrategy within Passport.
const tequila = new TequilaStrategy({
  service: 'Search Inside',
  request: ['displayname']
});
passport.use(tequila);

passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

const app = express();

app.use(expressSession({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', tequila.ensureAuthenticated, function (req, res) {
  res.send('Hello World');
});

const portNumber = process.env.PORT || 4444;
app.listen(portNumber);
console.log(
  'Server listening on 0.0.0.0 port ' + portNumber +
  ' (http://0.0.0.0:' + portNumber + '/)'
);
