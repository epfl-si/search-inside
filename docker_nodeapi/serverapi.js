const cors = require('cors');
const express = require('express');
const expressSession = require('express-session');
const morgan = require('morgan');
const passport = require('passport');
const TequilaStrategy = require('passport-tequila').Strategy;

const corsOpts = {
  origin: [
    process.env.SEARCH_INSIDE_SEARCH_URL
  ],
  credentials: true
};

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

app.use(morgan('combined'));
app.use(cors(corsOpts));
app.use(expressSession({
  secret: process.env.SEARCH_INSIDE_SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', tequila.ensureAuthenticated, function (req, res) {
  res.send('Hello World');
});

app.get('/auth/check', function (req, res) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false });
  }
  return res.json({ success: true });
});

app.get('/auth/login', tequila.ensureAuthenticated, function (req, res) {
  res.redirect(process.env.SEARCH_INSIDE_SEARCH_URL);
});

app.get('/auth/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.json({ success: true });
  });
});

const portNumber = process.env.PORT || 4444;
app.listen(portNumber);
console.log(
  'Server listening on 0.0.0.0 port ' + portNumber +
  ' (http://0.0.0.0:' + portNumber + '/)'
);
