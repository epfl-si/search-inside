const axios = require('axios')
const html_entities = require('html-entities')
const request = require('request').defaults({ encoding: null })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

//let url = 'https://searchinside-elastic.epfl.ch'
let url = 'http://search-inside-elastic:9200'

//Sites
let sites = ['help-wordpress', 'ae', 'internalhr', 'finances'];

//Read url and write the content of pages in elasticsearch
const getPages = async (site) => {
    console.log('getPages')

    return axios
        .get(`https://inside.epfl.ch/${site}/wp-json/wp/v2/pages?per_page=100`)
        .then((result) => result)
        .catch((error) => {
            console.error('Erreur get pages ' + error)
        })
    
}

//Read url and write the content of medias in elasticsearch
const getMedias = async (site) => {
    console.log('getMedias')
    
        console.log("MEDIA : " + site)
        return axios
        .get(`https://inside.epfl.ch/${site}/wp-json/wp/v2/media?per_page=100`)
        .then((result) => result)
        .catch((error) => {
            console.error('Erreur get medias ' + error)
        })
}

//Convert file to base64
const convert_files_to_base64 = async (file_name, source_media) => {
    console.log('convert_files_to_base64_debut ' + file_name + new Date().toISOString())
    try {
        //Convert file from url to base64
        request.get(`${source_media}`, async function (error, response, body) {
            data = Buffer.from(body).toString('base64')
            axios({
                method: 'POST',
                url: `${url}/inside_temp/_doc?pipeline=attachment`,
                data: {
                    url: `${source_media}`,
                    rights: `test`,
                    data: `${data}`,
                },
            })
        })

        console.log('convert_files_to_base64_fin ' + file_name + new Date().toISOString())
    } catch (e) {
        console.log('Erreur base64 ' + e)
    }
}

const write_data_pages = async (link_page, title_page, StripHTMLBreakLines) => {
    console.log('write_data_pages_debut ' + title_page + new Date().toISOString())
    try {
        //Write the data into elasticsearch
        axios({
            method: 'POST',
            url: `${url}/inside_temp/_doc`,
            data: {
                url: `${link_page}`,
                title: `${title_page}`,
                description: `${StripHTMLBreakLines}`,
                rights: 'test',
            },
        })

        console.log('write_data_pages_fin ' + title_page + new Date().toISOString())
    } catch (e) {
        console.log('Erreur write data pages ' + e)
    }
}

//Delete inside temp
const delete_inside_temp = async () => {
    console.log('delete_inside_temp_debut' + new Date().toISOString())
    return axios
        .delete(`${url}/inside_temp`)
        .then((result) => result)
        .catch((error) => {
            console.error('Erreur delete inside temp ' + error)
        })
}

//Delete inside temp
const delete_inside = async () => {
    console.log('delete_inside_debut' + new Date().toISOString())
    return axios
        .delete(`${url}/inside`)
        .then((result) => {
            result
            console.log(result.status)
        })
        .catch((error) => {
            console.error('Erreur delete inside ' + error)
        })
}

//Create inside temp
const create_inside_temp = async () => {
    console.log('create_inside_temp_debut' + new Date().toISOString())
    try {
        axios({
            method: 'POST',
            url: `${url}/inside_temp/_doc/`,
            data: {
                mappings: {
                    properties: {
                        url: {
                            type: 'text',
                        },
                        title: {
                            type: 'text',
                        },
                        description: {
                            type: 'text',
                        },
                        rights: {
                            type: 'text',
                        },
                        attachment: {
                            properties: {
                                content: {
                                    type: 'text',
                                },
                            },
                        },
                    },
                },
            },
        })

        console.log('create_inside_temp_fin' + new Date().toISOString())
    } catch (e) {
        console.log('Erreur create inside temp ' + e)
    }
}

//Create attachment field
const create_attachment_field = async () => {
    console.log('create_attachement_field_debut' + new Date().toISOString())
    try {
        axios({
            method: 'PUT',
            url: `${url}/_ingest/pipeline/attachment`,
            data: {
                description: 'Extract attachment information',
                processors: [
                    {
                        attachment: {
                            field: 'data',
                        },
                    },
                ],
            },
        })

        console.log('create_attachement_field_fin' + new Date().toISOString())
    } catch (e) {
        console.log('Erreur create attachment field ' + e)
    }
}

//Copy inside temp into inside
const copy_inside_temp_to_inside = async () => {
    console.log('copy_inside_temp_to_inside_debut' + new Date().toISOString())
    //Put the inside_temp into inside
    return axios
        .post(`${url}/_reindex`, {
            source: {
                index: 'inside_temp',
            },
            dest: {
                index: 'inside',
            },
        })
        .then((result) => {
            result
            console.log(result.data)
        })
        .catch((error) => {
            console.error('Erreur copy temp to inside ' + error)
        })
}

//Get data from pages and medias
const get_data_from_pages = async () => {
    console.log('get_data_from_pages_debut' + new Date().toISOString())
    try {
        for (let site of sites) {
                console.log(site);
            let pages = await getPages(site)

            // loop over each entries to display title
            for (let page of pages.data) {
                let link_page = page.link
                let title_page = page.title.rendered

                let content_page = page.content.rendered
                let StripHTML = content_page.replace(/(<([^>]+)>)/gi, '')
                let StripHTMLUTF8 = html_entities.decode(StripHTML)
                let StripHTMLBreakLines = StripHTMLUTF8.replace(/\r?\n|\r/g, '')
                await write_data_pages(link_page, title_page, StripHTMLBreakLines)
            }

            console.log('get_data_from_pages_fin' + new Date().toISOString())
            }
    } catch (e) {
        console.log('Erreur get data from pages ' + e)
    }
}

//Get data from pages and medias
const get_data_from_medias = async () => {
    console.log('get_data_from_medias_debut' + new Date().toISOString())
    try {

        for (let site of sites) {
            console.log(site);

        // loop over each entries to display title
        let medias = await getMedias(site)

        // loop over each data entries
        for (let media of medias.data) {
            //get source of the media
            let source_media = media.source_url

            if (source_media.match(/\.[^.]*$/g) == '.pdf') {
                let file_name = source_media.match(/(?<=\/)[^/]*$/g)
                console.log(`${file_name}`)
                await convert_files_to_base64(file_name, source_media)
            } else {
                console.log('file is not a pdf :' + `${source_media}`)
            }
        }

            console.log('get_data_from_medias_fin' + new Date().toISOString())
        }
    } catch (e) {
        console.log('Erreur get data from medias' + e)
    }
}

const launch_script = async () => {
    console.log('launch_script')
    await delete_inside_temp()
    //waiting 2 seconds
    await delay(2000) 
    await create_inside_temp()
    await delay(2000)
    await create_attachment_field()
    await delay(2000)
    await get_data_from_pages()
    await get_data_from_medias()
    await delay(2000)
    await delete_inside()
    await delay(2000)
    await copy_inside_temp_to_inside()
}

launch_script()