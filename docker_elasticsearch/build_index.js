const axios = require('axios');
const htmlEntities = require('html-entities');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const https = require('https');
const { convert } = require('html-to-text');

const SEARCH_INSIDE_ELASTIC_PASSWORD = process.env.SEARCH_INSIDE_ELASTIC_PASSWORD;
const SEARCH_INSIDE_API_RO_USERNAME = process.env.SEARCH_INSIDE_API_RO_USERNAME;
const SEARCH_INSIDE_API_RO_PASSWORD = process.env.SEARCH_INSIDE_API_RO_PASSWORD;
const SEARCH_INSIDE_KIBANA_PASSWORD = process.env.SEARCH_INSIDE_KIBANA_PASSWORD;
const ELASTIC_HOST = process.env.ELASTIC_HOST;
const WP_VERITAS_HOST = process.env.WP_VERITAS_HOST;
const INSIDE_HOST = process.env.INSIDE_HOST;
const INSIDE_HOST_HEADER_HOST = process.env.INSIDE_HOST_HEADER_HOST;

const insideSites = [];
const agent = new https.Agent({ rejectUnauthorized: false });
const authElastic = {
  username: 'elastic',
  password: SEARCH_INSIDE_ELASTIC_PASSWORD
};

let totalPagesIndexed = 0;
let totalMediasIndexed = 0;

// Check that all environment variables are not empty
const checkEnvVars = () => {
  if (!SEARCH_INSIDE_ELASTIC_PASSWORD) {
    console.log('ERROR: env SEARCH_INSIDE_ELASTIC_PASSWORD is empty.'); process.exit(1);
  }
  if (!SEARCH_INSIDE_API_RO_USERNAME) {
    console.log('ERROR: env SEARCH_INSIDE_API_RO_USERNAME is empty.'); process.exit(1);
  }
  if (!SEARCH_INSIDE_API_RO_PASSWORD) {
    console.log('ERROR: env SEARCH_INSIDE_API_RO_PASSWORD is empty.'); process.exit(1);
  }
  if (!ELASTIC_HOST) { console.log('ERROR: env ELASTIC_HOST is empty.'); process.exit(1); }
  if (!WP_VERITAS_HOST) { console.log('ERROR: env WP_VERITAS_HOST is empty.'); process.exit(1); }
  if (!INSIDE_HOST) { console.log('ERROR: env INSIDE_HOST is empty.'); process.exit(1); }
  if (!INSIDE_HOST_HEADER_HOST) { console.log('ERROR: env INSIDE_HOST_HEADER_HOST is empty.'); process.exit(1); }
};

// Set inside sites to index
const setInsideSites = async () => {
  console.log('Preparing inside sites to index...');
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
        console.error('Error get inside sites: ' + error);
        process.exit(1);
      });
  }
};

// Create inside index
const createInsideIndex = async () => {
  await axios.put(`${ELASTIC_HOST}/inside`, {
    mappings: {
      properties: {
        url: { type: 'text' },
        title: { type: 'text' },
        description: { type: 'text' },
        rights: { type: 'text' },
        attachment: {
          properties: {
            content: { type: 'text' }
          }
        }
      }
    }
  }, { auth: authElastic })
    .catch((error) => {
      console.log('Error create inside index: ' + error);
      process.exit(1);
    });
};

// Create attachment field
const createAttachmentField = async () => {
  await axios.put(`${ELASTIC_HOST}/_ingest/pipeline/attachment`, {
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
  }, { auth: authElastic })
    .catch((error) => {
      console.log('Error create attachment field: ' + error);
      process.exit(1);
    });
};

// Create user, role and rolemapping
const createUserAndRole = async () => {
  console.log('Create user, role and role_mapping...');

  // Create role 'inside_read'
  await axios.post(`${ELASTIC_HOST}/_security/role/inside_read`, {
    cluster: ['monitor'],
    indices: [{
      names: ['inside'],
      privileges: ['read', 'view_index_metadata']
    }]
  }, { auth: authElastic })
    .catch((error) => {
      console.log('Error create role: ' + error);
      process.exit(1);
    });

  // Create user 'inside-api-user'
  await axios.post(`${ELASTIC_HOST}/_security/user/${SEARCH_INSIDE_API_RO_USERNAME}`, {
    password: SEARCH_INSIDE_API_RO_PASSWORD,
    roles: ['inside_read']
  }, { auth: authElastic })
    .catch((error) => {
      console.log('Error create user: ' + error);
      process.exit(1);
    });

  // Create role mapping
  await axios.post(`${ELASTIC_HOST}/_security/role_mapping/mapping_inside`, {
    roles: ['inside_read'],
    enabled: true,
    rules: {
      field: { username: SEARCH_INSIDE_API_RO_USERNAME }
    },
    metadata: { version: 1 }
  }, { auth: authElastic })
    .catch((error) => {
      console.log('Error create role mapping: ' + error);
      process.exit(1);
    });
};

// Set kibana_system password (optionnal)
const setKibanaPassword = async () => {
  if (SEARCH_INSIDE_KIBANA_PASSWORD) {
    await axios.post(`${ELASTIC_HOST}/_security/user/kibana_system/_password`, {
      password: SEARCH_INSIDE_KIBANA_PASSWORD
    }, { auth: authElastic })
      .catch((error) => {
        console.log('Error set kibana_system password: ' + error);
        process.exit(1);
      });
  }
};

// Get all pages data of a site
const getPages = async (site) => {
  let pages = [];
  let currentPage = 0;
  let totalPage = 0;

  do {
    const response = await axios
      .get(`https://${INSIDE_HOST}/${site}/wp-json/wp/v2/pages?per_page=100&page=${++currentPage}`, {
        httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST }
      })
      .catch((error) => {
        console.error('Error get pages (site: ' + site + ', page: ' + currentPage + '): ' + error);
      });
    // temporary fix
    if (!response) {
      return pages;
    }
    if (totalPage === 0) {
      totalPage = response.headers['x-wp-totalpages'];
    }
    pages = pages.concat(response.data);
  } while (currentPage < totalPage);

  return pages;
};

// Get all medias data of a site
const getMedias = async (site) => {
  let medias = [];
  let currentPage = 0;
  let totalPage = 0;

  do {
    const response = await axios
      .get(`https://${INSIDE_HOST}/${site}/wp-json/wp/v2/media?per_page=100&page=${++currentPage}`, {
        httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST }
      })
      .catch((error) => {
        console.error('Error get medias (page: ' + currentPage + '): ' + error);
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
  // Write the data into elasticsearch
  await axios.post(`${ELASTIC_HOST}/inside/_doc`, {
    url: `${linkPage}`,
    title: `${titlePage}`,
    description: `${StripHTMLBreakLines}`,
    rights: 'test'
  }, { auth: authElastic })
    .catch((error) => {
      console.log('Error POST index page: ' + error);
      process.exit(1);
    });
  totalPagesIndexed++;
};

// Index a media (pdf, doc and docx for the moment)
const indexMedia = async (fileName, sourceMedia) => {
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
      }, { maxBodyLength: Infinity, auth: authElastic })
        .then((result) => {
          totalMediasIndexed++;
        }).catch((error) => {
          console.log('Error POST index attachment: ' + error);
          process.exit(1);
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
    process.exit(1);
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
    process.exit(1);
  }
  console.log('** Total medias indexed: ' + totalMediasIndexed);
  console.timeEnd('indexAllMedias');
};

const build = async () => {
  console.time('build');
  checkEnvVars();
  await setInsideSites();
  await createInsideIndex();
  await createAttachmentField();
  await createUserAndRole();
  await setKibanaPassword();
  await indexAllPages();
  // await indexAllMedias();
  await delay(2000);
  console.log('\n** Total ******************** ');
  console.log(totalPagesIndexed + ' pages indexed.');
  console.log(totalMediasIndexed + ' medias indexed.\n');
  console.timeEnd('build');
  console.log('Finished at ' + new Date().toISOString());
};

build();
