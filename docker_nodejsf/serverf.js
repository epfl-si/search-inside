const exphbs = require('express-handlebars');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();

const hbs = exphbs.create({
  helpers: {
    short_description: function (value, query) {
      if (value !== undefined) {
        const posQuery = value.toLowerCase().indexOf(query.toLowerCase());
        const sizeQuery = query.length;
        const sizeBeforeAfter = 100;
        let result = '';
        if (posQuery === -1) {
          result = value.substring(0, sizeBeforeAfter);
        } else {
          if (posQuery >= sizeBeforeAfter) {
            result =
              '[...] ' +
              value.substring(posQuery - sizeBeforeAfter, posQuery) +
              '<b>' +
              value.substring(posQuery, posQuery + sizeQuery) +
              '</b>' +
              value.substring(posQuery + sizeQuery, posQuery + sizeQuery + sizeBeforeAfter);
          } else {
            result =
              value.substring(0, posQuery) +
              '<b>' +
              value.substring(posQuery, posQuery + sizeQuery) +
              '</b>' +
              value.substring(posQuery + sizeQuery, posQuery + sizeQuery + sizeBeforeAfter);
          }
        }
        const sizeQueryToEnd = value.substring(posQuery + sizeQuery).length;
        if (sizeQueryToEnd > sizeBeforeAfter) {
          return result + ' [...]';
        }
        return result;
      } else {
        return '';
      }
    }
  }
});

const viewPath = path.join(__dirname, 'views');

app.set('views', viewPath);
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (request, response) => {
  response.render('index', { result: '', query: '', title: 'Elasticsearch Inside' });
});

app.post('/', (request, response) => {
  const getResearch = request.body.research;
  // let url = 'https://searchinside-elastic.epfl.ch'
  const url = 'http://search-inside-elastic:9200';

  const getPages = async () => {
    return axios
      .get(`${url}/inside/_search?q=${getResearch}`)
      .then((result) => result)
      .catch((error) => {
        console.error('Erreur copy temp to inside ' + error);
      });
  };

  const getData = async () => {
    const pages = await getPages();
    response.render('index', { query: getResearch, title: 'Elasticsearch Inside', result: pages.data.hits.hits });
  };

  getData();
});

app.listen(5603);
