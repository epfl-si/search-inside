const axios = require('axios');
const htmlEntities = require('html-entities');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const https = require('https');
const { convert } = require('html-to-text');

const ELASTIC_HOST = process.env.ELASTIC_HOST;
const WP_VERITAS_HOST = process.env.WP_VERITAS_HOST;
const INSIDE_HOST = process.env.INSIDE_HOST;
const INSIDE_HOST_HEADER_HOST = process.env.INSIDE_HOST_HEADER_HOST;
const insideSites = [];

let totalPagesIndexed = 0;
let totalMediasIndexed = 0;

// Check that all environment variables are defined
const checkEnvVars = () => {
  if (!ELASTIC_HOST) { console.log('ERROR: env ELASTIC_HOST is not defined.'); process.exit(1); }
  if (!WP_VERITAS_HOST) { console.log('ERROR: env WP_VERITAS_HOST is not defined.'); process.exit(1); }
  if (!INSIDE_HOST) { console.log('ERROR: env INSIDE_HOST is not defined.'); process.exit(1); }
  if (!INSIDE_HOST_HEADER_HOST) { console.log('ERROR: env INSIDE_HOST_HEADER_HOST is not defined.'); process.exit(1); }
};

// Set inside sites to index
const setInsideSites = async () => {
  console.log('Preparing inside sites to index...');
  const agent = new https.Agent({ rejectUnauthorized: false });
  const restrictedGroupNameAuthorized = ['', 'intranet-epfl'];

  if (process.env.BUILD_ENV === 'local') {
    insideSites.push('help-wordpress');
    console.log('Running locally: We crawl only https://inside.epfl.ch/help-wordpress');
  } else {
    await axios
      .get(
        `https://${WP_VERITAS_HOST}/api/v1/categories/Inside/sites`
      ).then(async (response) => {
        for (const siteData of response.data) {
          const site = siteData.url.replace(/\/$/, '').split('/').pop();
          // For V1 - We index only inside sites that do no have group restrictions (except intranet-epfl)
          await axios
            .get(
              `https://${INSIDE_HOST}/${site}/wp-json/epfl-intranet/v1/groups`,
              { httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST } }
            ).then((response) => {
              for (const group of response.data) {
                const groupName = group.group_name;
                if (restrictedGroupNameAuthorized.includes(groupName)) {
                  insideSites.push(site);
                  break;
                }
              }
            }).catch((error) => {
              console.log('Error get inside restricted groups (site: ' + site + '): ' + error);
            });
        }
        console.log('Total: ' + insideSites.length + ' inside sites to index');
        console.log(insideSites);
      }).catch((error) => {
        console.error('Error getInsideSites: ' + error);
      });
  }
};

// Get all pages data of a site
const getPages = async (site) => {
  const agent = new https.Agent({ rejectUnauthorized: false });

  let pages = [];
  let currentPage = 0;
  let totalPage = 0;

  do {
    const response = await axios
      .get(
        `https://${INSIDE_HOST}/${site}/wp-json/wp/v2/pages?per_page=100&page=${++currentPage}`,
        { httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST } }
      )
      .catch((error) => {
        console.error('Error getPages (site: ' + site + ', page: ' + currentPage + '): ' + error);
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
        `https://${INSIDE_HOST}/${site}/wp-json/wp/v2/media?per_page=100&page=${++currentPage}`,
        { httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST } }
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
    await axios({
      method: 'POST',
      url: `${ELASTIC_HOST}/inside/_doc`,
      data: {
        url: `${linkPage}`,
        title: `${titlePage}`,
        description: `${StripHTMLBreakLines}`,
        rights: 'test'
      }
    });
    totalPagesIndexed++;
  } catch (e) {
    console.log('Error POST indexPage: ' + e);
  }
};

// Index a media (pdf, doc and docx for the moment)
const indexMedia = async (fileName, sourceMedia) => {
  const agent = new https.Agent({ rejectUnauthorized: false });

  try {
    const sourceMediaTmp = sourceMedia.replace(INSIDE_HOST_HEADER_HOST, INSIDE_HOST);

    await axios.get(sourceMediaTmp, {
      responseType: 'arraybuffer', httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST }
    }).then(async (response) => {
      const data = Buffer.from(response.data, 'binary').toString('base64');

      await axios.post(`${ELASTIC_HOST}/inside/_doc?pipeline=attachment`, {
        url: `${sourceMedia}`,
        title: `${fileName}`,
        data: `${data}`,
        rights: 'test'
      }, { maxBodyLength: Infinity }).then((result) => {
        totalMediasIndexed++;
      }).catch((error) => {
        console.log('Error POST attachment: ' + error);
      });
    }).catch((error) => {
      console.log('Error get media (' + sourceMediaTmp + '): ' + error);
    });
  } catch (e) {
    console.log('Error indexMedia: ' + e);
  }
};

// Index all pages
const indexAllPages = async () => {
  console.log('Indexing pages...');
  console.time('indexAllPages');
  try {
    for (const site of insideSites) {
      let count = 0;
      console.time('indexAllPages (' + site + ')');
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

        count++;
        await indexPage(linkPage, titlePage, contentPage);
      }
      console.timeEnd('indexAllPages (' + site + ')');
      console.log('total (pages): ' + count);
    }
  } catch (e) {
    console.log('Error indexAllPages: ' + e);
  }
  console.log('Total pages indexed: ' + totalPagesIndexed);
  console.timeEnd('indexAllPages');
};

// Index all medias
const indexAllMedias = async () => {
  try {
    console.log('Indexing medias...');
    const authorizedMimeTypes = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    console.time('indexAllMedias');

    for (const site of insideSites) {
      let count = 0;
      console.time('indexAllMedias (' + site + ')');
      const medias = await getMedias(site);

      for (const media of medias) {
        const sourceMedia = media.source_url;

        if (authorizedMimeTypes.includes(media.mime_type)) {
          count++;
          const fileName = sourceMedia.match(/(?<=\/)[^/]*$/g);
          await indexMedia(fileName, sourceMedia);
        }
      }
      console.timeEnd('indexAllMedias (' + site + ')');
      console.log('total (medias): ' + count);
    }
  } catch (e) {
    console.log('Error indexAllMedias: ' + e);
  }
  console.log('** Total medias indexed: ' + totalMediasIndexed);
  console.timeEnd('indexAllMedias');
};

// Create inside index
const createInsideIndex = async () => {
  try {
    axios({
      method: 'PUT',
      url: `${ELASTIC_HOST}/inside`,
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
    console.log('Error createInsideIndex: ' + e);
  }
};

// Create attachment field
const createAttachmentField = async () => {
  try {
    axios({
      method: 'PUT',
      url: `${ELASTIC_HOST}/_ingest/pipeline/attachment`,
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

const build = async () => {
  console.time('build');
  checkEnvVars();
  await setInsideSites();
  await createInsideIndex();
  await createAttachmentField();
  await indexAllPages();
  await indexAllMedias();
  await delay(2000);
  console.log('\n** Total ******************** ');
  console.log(totalPagesIndexed + ' pages indexed.');
  console.log(totalMediasIndexed + ' medias indexed.\n');
  console.timeEnd('build');
  console.log('Finished at ' + new Date().toISOString());
};

build();
