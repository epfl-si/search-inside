const axios = require('axios');
const htmlEntities = require('html-entities');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const https = require('https');
const { convert } = require('html-to-text');

const url = 'http://search-inside-elastic:9200';
let sites = ['ae', 'chili', 'cipd', 'corp-id', 'help-wordpress', 'ic', 'internalhr', 'lcbc', 'library', 'lrm',
  'lts4', 'sti-it', 'sti-ta', 'sv-it', 'teaching', 'finances'];

// Adapt host of inside websites and websites to include, depending where it is running (OS or public)
let insideHost = 'httpd-inside:8443';
if (process.env.RUNNING_HOST === 'local' || process.env.RUNNING_HOST === 'wwp-test') {
  insideHost = 'inside.epfl.ch';
  sites = ['help-wordpress'];
}

// Get all pages data of a site
const getPages = async (site) => {
  const agent = new https.Agent({ rejectUnauthorized: false });

  let pages = [];
  let currentPage = 0;
  let totalPage = 0;

  do {
    const response = await axios
      .get(
        `https://${insideHost}/${site}/wp-json/wp/v2/pages?per_page=100&page=${++currentPage}`,
        { httpsAgent: agent, headers: { Host: 'inside.epfl.ch' } }
      )
      .catch((error) => {
        console.error('Error getPages (page: ' + currentPage + '): ' + error);
      });
    if (totalPage === 0) {
      totalPage = response.headers['x-wp-totalpages'];
    }
    pages = pages.concat(response.data);
  } while (currentPage < totalPage);

  return pages;
};

// Get all medias data of a site
const getMedias = async (site) => {
  const agent = new https.Agent({ rejectUnauthorized: false });

  let medias = [];
  let currentPage = 0;
  let totalPage = 0;

  do {
    const response = await axios
      .get(
        `https://${insideHost}/${site}/wp-json/wp/v2/media?per_page=100&page=${++currentPage}`,
        { httpsAgent: agent, headers: { Host: 'inside.epfl.ch' } }
      )
      .catch((error) => {
        console.error('Error getMedias (page: ' + currentPage + '): ' + error);
      });
    if (totalPage === 0) {
      totalPage = response.headers['x-wp-totalpages'];
    }
    medias = medias.concat(response.data);
  } while (currentPage < totalPage);

  return medias;
};

// Index a page
const indexPage = async (linkPage, titlePage, StripHTMLBreakLines) => {
  try {
    // Write the data into elasticsearch
    axios({
      method: 'POST',
      url: `${url}/inside_temp/_doc`,
      data: {
        url: `${linkPage}`,
        title: `${titlePage}`,
        description: `${StripHTMLBreakLines}`,
        rights: 'test'
      }
    });
  } catch (e) {
    console.log('Error POST indexPage: ' + e);
  }
};

// Index a media (pdf only for the moment)
const indexMedia = async (fileName, sourceMedia) => {
  const agent = new https.Agent({ rejectUnauthorized: false });

  try {
    const sourceMediaTmp = sourceMedia.replace(/inside.epfl.ch/, insideHost);

    await axios.get(sourceMediaTmp, {
      responseType: 'arraybuffer', httpsAgent: agent, headers: { Host: 'inside.epfl.ch' }
    })
      .then((response) => {
        const data = Buffer.from(response.data, 'binary').toString('base64');

        axios.post(`${url}/inside_temp/_doc?pipeline=attachment`, {
          url: `${sourceMedia}`,
          title: `${fileName}`,
          data: `${data}`,
          rights: 'test'
        }, { maxBodyLength: Infinity })
          .catch((error) => {
            console.log('Error POST attachment: ' + error);
          });
      })
      .catch((error) => {
        console.log('Error get media: ' + error);
      });
  } catch (e) {
    console.log('Error indexMedia: ' + e);
  }
};

// Index all pages
const indexAllPages = async () => {
  console.time('indexAllPages');
  try {
    for (const site of sites) {
      const pages = await getPages(site);

      for (const page of pages) {
        const linkPage = page.link;
        const titlePage = htmlEntities.decode(page.title.rendered);

        let contentPage = page.content.rendered;

        // Convert HTML to beautiful text
        contentPage = convert(contentPage, {
          selectors: [
            { selector: 'ul', options: { itemPrefix: '· ' } },
            { selector: 'a', options: { ignoreHref: true } },
            { selector: 'img', format: 'skip' },
            { selector: 'h1', format: 'block' },
            { selector: 'h2', format: 'block' },
            { selector: 'h3', format: 'block' },
            { selector: 'h4', format: 'block' },
            { selector: 'h5', format: 'block' },
            { selector: 'h6', format: 'block' },
            { selector: 'th', format: 'block' },
            { selector: 'td', format: 'block' }
          ]
        });

        // Convert HTML entities to characters
        contentPage = htmlEntities.decode(contentPage);
        // Replace any whitespace character
        contentPage = contentPage.replace(/\s/g, ' ');
        // Fine tune ul rendered
        contentPage = contentPage.replace(/ +·/g, ' ·');
        // Delete multiple space
        contentPage = contentPage.replace(/ +/g, ' ');

        await indexPage(linkPage, titlePage, contentPage);
      }
    }
  } catch (e) {
    console.log('Error indexAllPages: ' + e);
  }
  console.timeEnd('indexAllPages');
};

// Index all medias
const indexAllMedias = async () => {
  console.time('indexAllMedias');
  try {
    for (const site of sites) {
      let count = 0;
      console.time('indexAllMedias (' + site + ')');
      const medias = await getMedias(site);

      for (const media of medias) {
        const sourceMedia = media.source_url;

        if (media.mime_type === 'application/pdf') {
          count++;
          const fileName = sourceMedia.match(/(?<=\/)[^/]*$/g);
          await indexMedia(fileName, sourceMedia);
        } else {
          console.log('file is not a pdf: ' + sourceMedia);
        }
      }
      console.timeEnd('indexAllMedias (' + site + ')');
      console.log('total (pdf): ' + count);
    }
  } catch (e) {
    console.log('Erreur get data from medias' + e);
  }
  console.timeEnd('indexAllMedias');
};

// Delete inside temp
const deleteInsideTemp = async () => {
  console.log('deleteInsideTemp');
  return axios
    .delete(`${url}/inside_temp`)
    .catch((error) => {
      console.error('Error deleteInsideTemp: ' + error);
    });
};

// Delete inside temp
const deleteInside = async () => {
  console.time('deleteInside');
  return axios
    .delete(`${url}/inside`)
    .then((result) => {
      console.timeEnd('deleteInside');
    })
    .catch((error) => {
      console.error('Error deleteInside: ' + error);
    });
};

// Create inside temp
const createInsideTemp = async () => {
  try {
    axios({
      method: 'PUT',
      url: `${url}/inside_temp`,
      data: {
        mappings: {
          properties: {
            url: {
              type: 'text'
            },
            title: {
              type: 'text'
            },
            description: {
              type: 'text'
            },
            rights: {
              type: 'text'
            },
            attachment: {
              properties: {
                content: {
                  type: 'text'
                }
              }
            }
          }
        }
      }
    });
  } catch (e) {
    console.log('Erreur createInsideTemp: ' + e);
  }
};

// Create attachment field
const createAttachmentField = async () => {
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
              remove_binary: true,
              properties: ['content', 'title', 'content_type', 'language', 'content_length']
            }
          }
        ]
      }
    });
  } catch (e) {
    console.log('Error createAttachmentField: ' + e);
  }
};

// Copy inside temp into inside
const copyInsideTempToInside = async () => {
  console.time('copyInsideTempToInside');
  // Put the inside_temp into inside
  return axios
    .post(`${url}/_reindex`, {
      source: {
        index: 'inside_temp'
      },
      dest: {
        index: 'inside'
      }
    })
    .then((result) => {
      console.timeEnd('copyInsideTempToInside');
      console.log(result.data);
    })
    .catch((error) => {
      console.error('Error copyInsideTempToInside: ' + error);
    });
};

const launchScript = async () => {
  console.time('launchScript');
  await deleteInsideTemp();
  await delay(2000);
  await createInsideTemp();
  await delay(2000);
  await createAttachmentField();
  await delay(2000);
  await indexAllPages();
  await indexAllMedias();
  await delay(2000);
  await deleteInside();
  await copyInsideTempToInside();
  await delay(2000);
  await deleteInsideTemp();
  console.timeEnd('launchScript');
};

launchScript();
