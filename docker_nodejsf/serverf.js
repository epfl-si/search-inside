let exphbs = require('express-handlebars')
let express = require('express')
let path = require('path')
let bodyParser = require('body-parser')
let axios = require('axios')

let app = express()

const hbs = exphbs.create({
    helpers: {
        short_description: function (value, query) {
            if (value != undefined) {
                pos_query = value.toLowerCase().indexOf(query.toLowerCase())
                size_query = query.length
                size_before_after = 100
                if (pos_query >= size_before_after) {
                    result =
                        '[...] ' +
                        value.substring(pos_query - size_before_after, pos_query) +
                        '<b>' +
                        value.substring(pos_query, pos_query + size_query) +
                        '</b>' +
                        value.substring(pos_query + size_query, pos_query + size_query + size_before_after)
                } else {
                    result =
                        value.substring(0, pos_query) +
                        '<b>' +
                        value.substring(pos_query, pos_query + size_query) +
                        '</b>' +
                        value.substring(pos_query + size_query, pos_query + size_query + size_before_after)
                }
                size_query_to_end = value.substring(pos_query + size_query).length
                if (size_query_to_end > size_before_after) {
                    return result + ' [...]'
                }
                return result
            } else {
                return
            }
        },
    },
})
var viewPath = path.join(__dirname, 'views');
app.set('views', viewPath);
app.engine('handlebars', hbs.engine)
app.set('view engine', 'handlebars')

app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get('/', (request, response) => {
    response.render('index', { result: '', query: '', title: 'Elasticsearch Inside' })
})

app.post('/', (request, response) => {
    let get_research = request.body.research
    //let url = 'https://searchinside-elastic.epfl.ch'
    let url = 'http://search-inside-elastic:9200'

    const getPages = async () => {
        return axios
            .get(`${url}/inside/_search?q=${get_research}`)
            .then((result) => result)
            .catch((error) => {
                console.error('Erreur copy temp to inside ' + error)
            })
    }

    const getData = async () => {
        let pages = await getPages()
        response.render('index', { query: get_research, title: 'Elasticsearch Inside', result: pages.data.hits.hits })
    }

    getData()
})

app.listen(5603)
