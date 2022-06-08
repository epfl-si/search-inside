const axios = require('axios');
const cors = require('cors');
const express = require('express');
const expressSession = require('express-session');
const morgan = require('morgan');
const passport = require('passport');

const MemoryStore = require('memorystore')(expressSession);
const TequilaStrategy = require('passport-tequila').Strategy;

const elasticSearchParams = {
  query: {
    simple_query_string: {
      default_operator: 'and',
      fields: [
        'title',
        'description',
        'url',
        'attachment.title',
        'attachment.content'
      ]
    }
  },
  size: 10,
  highlight: {
    fragment_size: 200,
    pre_tags: '<b>',
    post_tags: '</b>',
    fields: {
      description: {},
      'attachment.content': {}
    }
  }
};

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
  cookie: { maxAge: 86400000 },
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  name: 'search-inside',
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
  const params = new URLSearchParams({
    q: req.query.q || '',
    filter: req.query.filter || '',
    type: req.query.type || '',
    sort: req.query.sort || ''
  });
  res.redirect(process.env.SEARCH_INSIDE_SEARCH_URL + '?' + params.toString());
});

app.get('/auth/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.json({ success: true });
  });
});

app.get('/api/search', function (req, res) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false });
  }

  elasticSearchParams.query.simple_query_string.query = req.query.q || '';
  elasticSearchParams.from = req.query.from || 0;

  axios.get(process.env.SEARCH_INSIDE_ELASTICSEARCH_URL + '/inside/_search', {
    params: {
      source: elasticSearchParams,
      source_content_type: 'application/json'
    }
  }).then(function (response) {
    return res.json(response.data);
  }).catch(function () {
    return res.status(500).json({ success: false });
  });
});

const portNumber = process.env.PORT || 4444;
app.listen(portNumber);
console.log(
  'Server listening on 0.0.0.0 port ' + portNumber +
  ' (http://0.0.0.0:' + portNumber + '/)'
);
