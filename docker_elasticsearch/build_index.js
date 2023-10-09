const axios = require('axios');
axios.defaults.timeout = 60000;

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

// Configuration of retry failed queries (on WordPress only)
const RETRY_MAX_COUNT = 3;
const RETRY_DELAY_MS = 60000;

const insideSites = [];
const agent = new https.Agent({ rejectUnauthorized: false });
const authElastic = {
  username: 'elastic',
  password: SEARCH_INSIDE_ELASTIC_PASSWORD
};

let retryCount = 0;
let totalPagesIndexed = 0;
let totalMediasIndexed = 0;

// Check that all environment variables are not empty
const checkEnvVars = () => {
  if (!SEARCH_INSIDE_ELASTIC_PASSWORD) {
    console.log('ERROR: env SEARCH_INSIDE_ELASTIC_PASSWORD is empty.'); process.exit(1);
  }
  if (!SEARCH_INSIDE_KIBANA_PASSWORD) {
    console.log('ERROR: env SEARCH_INSIDE_KIBANA_PASSWORD is empty.'); process.exit(1);
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

  if (process.env.INSIDE_SITES_TO_INDEX !== '') {
    // Useful specifically for building the index locally (dev)
    for (const site of process.env.INSIDE_SITES_TO_INDEX.split(',')) {
      insideSites.push(site);
    }
  } else {
    // Get the inside sites to index from WP Veritas
    const sitesFromVeritas = await axios
      .get(
        `https://${WP_VERITAS_HOST}/api/v1/categories/Inside/sites`
      ).catch((error) => {
        console.log('Error get inside sites: ' + error);
        process.exit(1);
      });

    for (const siteData of sitesFromVeritas.data) {
      // Get the site name (e.g. 'https://inside.epfl.ch/earl-hacker-tips/' → 'earl-hacker-tips')
      const site = siteData.url.replace(/\/$/, '').split('/').pop();

      // For the moment, we only index inside sites that do not have group restrictions (except intranet-epfl)
      const groupsResponse = await axios
        .get(
          `https://${INSIDE_HOST}/${site}/wp-json/epfl-intranet/v1/groups`,
          { httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST } }
        ).catch((error) => {
          console.log('Error get inside restricted groups (site: ' + site + '): ' + error);
          process.exit(1);
        });

      for (const group of groupsResponse.data) {
        const groupName = group.group_name;
        if (restrictedGroupNameAuthorized.includes(groupName)) {
          const comingSoonResponse = await axios
            .get(
              `https://${INSIDE_HOST}/${site}/wp-json/epfl/v1/coming-soon`,
              { httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST } }
            ).catch((error) => {
              console.log('Error get coming-soon status (site: ' + site + '): ' + error);
              process.exit(1);
            });
          if (comingSoonResponse.data.status === '0') {
            // Index the site only if plugin epfl-coming-soon is not activated
            insideSites.push(site);
          }
          break;
        }
      }
    }
    console.log('Total: ' + insideSites.length + ' inside sites to index');
    console.log(insideSites);
  }
};

// Create inside index
const createInsideIndex = async () => {
  console.log('Creating inside index...');
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
    .then((res) => {
      console.log(res.data);
    })
    .catch((error) => {
      console.log('Error create inside index: ' + error);
      process.exit(1);
    });
};

// Configure ingest attachment processor
const configureIngestAttachment = async () => {
  console.log('Configuring ingest attachment...');
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
    .then((res) => {
      console.log(res.data);
    })
    .catch((error) => {
      console.log('Error configure attachment: ' + error);
      process.exit(1);
    });
};

// Create user, role and rolemapping
const createUserAndRole = async () => {
  console.log('Creating user, role and role_mapping...');

  // Create role 'inside_read'
  await axios.post(`${ELASTIC_HOST}/_security/role/inside_read`, {
    cluster: ['monitor'],
    indices: [{
      names: ['inside'],
      privileges: ['read', 'view_index_metadata']
    }]
  }, { auth: authElastic })
    .then((res) => {
      console.log(res.data);
    })
    .catch((error) => {
      console.log('Error create role: ' + error);
      process.exit(1);
    });

  // Create user 'inside-api-user'
  await axios.post(`${ELASTIC_HOST}/_security/user/${SEARCH_INSIDE_API_RO_USERNAME}`, {
    password: SEARCH_INSIDE_API_RO_PASSWORD,
    roles: ['inside_read']
  }, { auth: authElastic })
    .then((res) => {
      console.log(res.data);
    })
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
    .then((res) => {
      console.log(res.data);
    })
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
        console.log('Error set Kibana password: ' + error);
        process.exit(1);
      });
  }
};

// Get all pages data of a site
const getPages = async (site) => {
  let pages = [];
  let currentPage = 1;
  let totalPage = 0;

  do {
    while (true) {
      const response = await axios
        .get(`https://${INSIDE_HOST}/${site}/wp-json/wp/v2/pages?per_page=100&page=${currentPage}`, {
          httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST }
        })
        .catch(async (error) => {
          console.log('Error get pages (site: ' + site + ', page: ' + currentPage + '): ' + error);
          if (retryCount++ === RETRY_MAX_COUNT) {
            console.log('Max retry count exceeded.');
            process.exit(1);
          }
          console.log('Retrying in ' + RETRY_DELAY_MS + 'ms.. (retryCount: ' + retryCount + ')');
          await delay(RETRY_DELAY_MS);
        });
      if (response) {
        if (totalPage === 0) {
          totalPage = response.headers['x-wp-totalpages'];
        }
        pages = pages.concat(response.data);
        break; // Exit the while loop (retry)
      }
    }
  } while (currentPage++ < totalPage);

  return pages;
};

// Get all medias data of a site
const getMedias = async (site) => {
  let medias = [];
  let currentPage = 1;
  let totalPage = 0;

  do {
    while (true) {
      const response = await axios
        .get(`https://${INSIDE_HOST}/${site}/wp-json/wp/v2/media?per_page=100&page=${currentPage}`, {
          httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST }
        })
        .catch(async (error) => {
          console.log('Error get medias (site: ' + site + ', page: ' + currentPage + '): ' + error);
          if (retryCount++ === RETRY_MAX_COUNT) {
            console.log('Max retry count exceeded.');
            process.exit(1);
          }
          console.log('Retrying in ' + RETRY_DELAY_MS + 'ms.. (retryCount: ' + retryCount + ')');
          await delay(RETRY_DELAY_MS);
        });
      if (response) {
        if (totalPage === 0) {
          totalPage = response.headers['x-wp-totalpages'];
        }
        medias = medias.concat(response.data);
        break; // Exit the while loop (retry)
      }
    }
  } while (currentPage++ < totalPage);

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
    // Adapt url return by the API
    const sourceMediaTmp = sourceMedia.replace(INSIDE_HOST_HEADER_HOST, INSIDE_HOST);

    while (true) {
      const response = await axios
        .get(encodeURI(sourceMediaTmp), {
          responseType: 'arraybuffer', httpsAgent: agent, headers: { Host: INSIDE_HOST_HEADER_HOST }
        }).catch(async (error) => {
          console.log('Error get media (' + sourceMediaTmp + '): ' + error);
          if (retryCount++ === RETRY_MAX_COUNT) {
            console.log('Max retry count exceeded.');
            process.exit(1);
          }
          console.log('Retrying in ' + RETRY_DELAY_MS + 'ms.. (retryCount: ' + retryCount + ')');
          await delay(RETRY_DELAY_MS);
        });
      if (response) {
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
            console.log('Error post index attachment: ' + error);
            process.exit(1);
          });
        break; // Exit the while loop (retry)
      }
    }
  } catch (e) {
    console.log('Error indexMedia: ' + e);
    process.exit(1);
  }
};

// Index all pages
const indexAllPages = async () => {
  console.log('Indexing all pages...');
  console.time('Duration (index pages of all sites)');
  try {
    for (const site of insideSites) {
      let count = 0;
      console.time('- site: ' + site);
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
      console.timeEnd('- site: ' + site);
      console.log('  - total pages: ' + count);
    }
  } catch (e) {
    console.log('Error indexAllPages: ' + e);
    process.exit(1);
  }
  console.log('Total pages indexed: ' + totalPagesIndexed);
  console.timeEnd('Duration (index pages of all sites)');
};

// Index all medias
const indexAllMedias = async () => {
  try {
    console.log('Indexing all medias...');
    const authorizedMimeTypes = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    console.time('Duration (index medias of all sites)');

    for (const site of insideSites) {
      let count = 0;
      console.time('- site: ' + site);
      const medias = await getMedias(site);

      for (const media of medias) {
        const sourceMedia = media.source_url;

        if (authorizedMimeTypes.includes(media.mime_type)) {
          count++;
          const fileName = sourceMedia.match(/(?<=\/)[^/]*$/g);
          await indexMedia(fileName, sourceMedia);
        }
      }
      console.timeEnd('- site: ' + site);
      console.log('  - total medias: ' + count);
    }
  } catch (e) {
    console.log('Error indexAllMedias: ' + e);
    process.exit(1);
  }
  console.log('Total medias indexed: ' + totalMediasIndexed);
  console.timeEnd('Duration (index medias of all sites)');
};

const build = async () => {
  console.time('Duration');
  checkEnvVars();
  await setInsideSites();
  await createInsideIndex();
  await configureIngestAttachment();
  await createUserAndRole();
  await setKibanaPassword();
  await indexAllPages();
  await indexAllMedias();
  await delay(2000);
  console.log('\nBuild index sucessful.\n');
  console.log('*********************************************************');
  console.timeEnd('Duration');
  console.log(totalPagesIndexed + ' pages indexed.');
  console.log(totalMediasIndexed + ' medias indexed.');
  console.log('*********************************************************\n');
};

build();
