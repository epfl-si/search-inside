const axios = require('axios');
const htmlEntities = require('html-entities');
const request = require('request').defaults({ encoding: null });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const https = require('https');
const { convert } = require('html-to-text');

const url = 'http://search-inside-elastic:9200';
let sites = ['ae', 'chili', 'cipd', 'corp-id', 'help-wordpress', 'ic', 'internalhr', 'lcbc', 'library', 'lrm',
  'lts4', 'sti-it', 'sti-ta', 'sv-it', 'teaching'];

// Adapt host of inside websites and websites to include, depending where it is running (OS or public)
let insideHost = 'httpd-inside:8443';
if (process.env.RUNNING_HOST === 'local' || process.env.RUNNING_HOST === 'wwp-test') {
  insideHost = 'inside.epfl.ch';
  sites = ['help-wordpress'];
}

// Read url and write the content of pages in elasticsearch
const getPages = async (site) => {
  console.log('getPages');

  const agent = new https.Agent({ rejectUnauthorized: false });

  return axios
    .get(
      `https://${insideHost}/${site}/wp-json/wp/v2/pages?per_page=100`,
      { httpsAgent: agent, headers: { Host: 'inside.epfl.ch' } }
    )
    .then((result) => result)
    .catch((error) => {
      console.error('Erreur get pages ' + error);
    });
};

// Read url and write the content of medias in elasticsearch
const getMedias = async (site) => {
  console.log('getMedias');

  const agent = new https.Agent({ rejectUnauthorized: false });

  return axios
    .get(
      `https://${insideHost}/${site}/wp-json/wp/v2/media?per_page=100`,
      { httpsAgent: agent, headers: { Host: 'inside.epfl.ch' } }
    )
    .then((result) => result)
    .catch((error) => {
      console.error('Erreur get medias ' + error);
    });
};

// Convert file to base64
const convertFilesToBase64 = async (fileName, sourceMedia) => {
  console.log('convertFilesToBase64_debut ' + fileName + new Date().toISOString());

  try {
    const sourceMediaTmp = sourceMedia.replace(/inside.epfl.ch/, insideHost);
    console.log('Get pdf from: ' + sourceMediaTmp);
    request.get(`${sourceMediaTmp}`, {
      rejectUnauthorized: false, headers: { Host: 'inside.epfl.ch' }
    }, async (error, response, body) => {
      if (error) {
        console.log('Error get sourceMedia: ' + error);
      } else {
        const data = Buffer.from(body).toString('base64');
        axios({
          method: 'POST',
          url: `${url}/inside_temp/_doc?pipeline=attachment`,
          data: {
            url: `${sourceMedia}`,
            rights: 'test',
            data: `${data}`
          }
        });
      }
    });

    console.log('convertFilesToBase64_fin ' + fileName + new Date().toISOString());
  } catch (e) {
    console.log('Erreur base64 ' + e);
  }
};

const writeDataPages = async (linkPage, titlePage, StripHTMLBreakLines) => {
  console.log('writeDataPages_debut ' + titlePage + new Date().toISOString());
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

    console.log('writeDataPages_fin ' + titlePage + new Date().toISOString());
  } catch (e) {
    console.log('Erreur write data pages ' + e);
  }
};

// Delete inside temp
const deleteInsideTemp = async () => {
  console.log('deleteInsideTemp_debut' + new Date().toISOString());
  return axios
    .delete(`${url}/inside_temp`)
    .then((result) => result)
    .catch((error) => {
      console.error('Erreur delete inside temp ' + error);
    });
};

// Delete inside temp
const deleteInside = async () => {
  console.log('deleteInside_debut' + new Date().toISOString());
  return axios
    .delete(`${url}/inside`)
    .then((result) => {
      console.log(result.status);
    })
    .catch((error) => {
      console.error('Erreur delete inside ' + error);
    });
};

// Create inside temp
const createInsideTemp = async () => {
  console.log('createInsideTemp_debut' + new Date().toISOString());
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

    console.log('createInsideTemp_fin' + new Date().toISOString());
  } catch (e) {
    console.log('Erreur create inside temp ' + e);
  }
};

// Create attachment field
const createAttachmentField = async () => {
  console.log('createAttachmentField_debut' + new Date().toISOString());
  try {
    axios({
      method: 'PUT',
      url: `${url}/_ingest/pipeline/attachment`,
      data: {
        description: 'Extract attachment information',
        processors: [
          {
            attachment: {
              field: 'data'
            }
          }
        ]
      }
    });
    console.log('createAttachmentField_fin' + new Date().toISOString());
  } catch (e) {
    console.log('Erreur create attachment field ' + e);
  }
};

// Copy inside temp into inside
const copyInsideTempToInside = async () => {
  console.log('copyInsideTempToInside_debut' + new Date().toISOString());
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
      console.log(result.data);
    })
    .catch((error) => {
      console.error('Erreur copy temp to inside ' + error);
    });
};

// Get data from pages and medias
const getDataFromPages = async () => {
  console.log('getDataFromPages_debut' + new Date().toISOString());
  try {
    for (const site of sites) {
      console.log(site);
      const pages = await getPages(site);

      // Loop over each entries
      for (const page of pages.data) {
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

        await writeDataPages(linkPage, titlePage, contentPage);
      }

      console.log('getDataFromPages_fin' + new Date().toISOString());
    }
  } catch (e) {
    console.log('Erreur get data from pages ' + e);
  }
};

// Get data from pages and medias
const getDataFromMedias = async () => {
  console.log('getDataFromMedias_debut' + new Date().toISOString());
  try {
    for (const site of sites) {
      console.log(site);

      // Loop over each entries to display title
      const medias = await getMedias(site);

      // Loop over each data entries
      for (const media of medias.data) {
        // Get source of the media
        const sourceMedia = media.source_url;

        if (sourceMedia.endsWith('.pdf')) {
          const fileName = sourceMedia.match(/(?<=\/)[^/]*$/g);
          console.log(`${fileName}`);
          await convertFilesToBase64(fileName, sourceMedia);
        } else {
          console.log('file is not a pdf :' + `${sourceMedia}`);
        }
      }
      console.log('getDataFromMedias_fin' + new Date().toISOString());
    }
  } catch (e) {
    console.log('Erreur get data from medias' + e);
  }
};

const launchScript = async () => {
  console.log('launchScript');
  await deleteInsideTemp();
  await delay(2000);
  await createInsideTemp();
  await delay(2000);
  await createAttachmentField();
  await delay(2000);
  await getDataFromPages();
  await getDataFromMedias();
  await delay(2000);
  await deleteInside();
  await delay(2000);
  await copyInsideTempToInside();
};

launchScript();
