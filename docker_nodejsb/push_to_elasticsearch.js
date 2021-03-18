const axios = require("axios");
const html_entities = require("html-entities");
const request = require("request").defaults({ encoding: null });
const os = require('os');


const network = async () => {
    var networkInterfaces = os.networkInterfaces();

    console.log(networkInterfaces);
};


//Read url and write the content of pages in elasticsearch
const getPages = async () => {
  console.log("getPages");
  return axios
    .get(
      "https://inside.epfl.ch/help-wordpress/wp-json/wp/v2/pages?per_page=100"
    )
    .then((result) => result)
    .catch((error) => {
      console.error(error);
    });
};

//Read url and write the content of medias in elasticsearch
const getMedias = async () => {
  console.log("getMedias");
  return axios
    .get(
      "https://inside.epfl.ch/help-wordpress/wp-json/wp/v2/media?per_page=100"
    )
    .then((result) => result)
    .catch((error) => {
      console.error(error);
    });
};

//Convert file to base64
const convert_files_to_base64 = async (file_name, source_media) => {
  console.log("convert_files_to_base64");

  //Convert file from url to base64
  request.get(`${source_media}`, async function (error, response, body) {
    console.log(source_media);
    data = Buffer.from(body).toString("base64");
    await write_data_medias(file_name, data, source_media);
  });
};

//Write data into elasticsearch
const write_data_medias = async (file_name, data, source_media) => {
  console.log("write_data_medias");
  //Write the data into elasticsearch
  return axios({
    method: "POST",
    url: `https://searchinside-elastic.epfl.ch/_doc?pipeline=attachment`,
    data: {
      url: `${source_media}`,
      rights: `test`,
      data: `${data}`,
    },
  });
};

const write_data_pages = async (link_page, title_page, StripHTMLBreakLines) => {
  console.log("write_data_pages");
  //Write the data into elasticsearch
  return axios({
    method: "POST",
    url: `https://searchinside-elastic.epfl.ch/_doc`,
    data: {
      url: `${link_page}`,
      title: `${title_page}`,
      description: `${StripHTMLBreakLines}`,
      rights: "test",
    },
  });
};

//Delete inside temp
const delete_inside_temp = async () => {
  console.log("delete_inside_temp");
  return axios({
    method: "DELETE",
    url: `http://search-inside-elastic.wwp-test.svc`,
  });
};

//Delete inside temp
const delete_inside = async () => {
  console.log("delete_inside");
  return axios({
    method: "DELETE",
    url: `http://search-inside-elastic.wwp-test.svc`,
  });
};

//Create inside temp
const create_inside_temp = async () => {
  console.log("create_inside_temp");
  return axios({
    method: "POST",
    url: `https://searchinside-elastic.epfl.ch/_doc/`,
    data: {
      mappings: {
        properties: {
          url: {
            type: "text",
          },
          title: {
            type: "text",
          },
          description: {
            type: "text",
          },
          rights: {
            type: "text",
          },
          attachment: {
            properties: {
              content: {
                type: "text",
              },
            },
          },
        },
      },
    },
  });
};

//Create attachment field
const create_attachment_field = async () => {
  console.log("create_attachement_field");
  return axios({
    method: "PUT",
    url: `https://searchinside-elastic.epfl.ch/_ingest/pipeline/attachment`,
    data: {
      description: "Extract attachment information",
      processors: [
        {
          attachment: {
            field: "data",
          },
        },
      ],
    },
  });
};

//Copy inside temp into inside
const copy_inside_temp_to_inside = async () => {
  console.log("copy_inside_temp_to_inside");

  //Put the inside_temp into inside
  return axios({
    method: "POST",
    url: `https://searchinside-elastic.epfl.ch/_reindex`,
    data: {
      source: {
        index: "inside_temp",
      },
      dest: {
        index: "inside",
      },
    },
  });
};

//Get data from pages and medias
const get_data_from_pages = async () => {
  console.log("get_data_from_pages");
  let pages = await getPages();

  // loop over each entries to display title
  for (let page of pages.data) {
    let link_page = page.link;
    let title_page = page.title.rendered;

    let content_page = page.content.rendered;
    let StripHTML = content_page.replace(/(<([^>]+)>)/gi, "");
    let StripHTMLUTF8 = html_entities.decode(StripHTML);
    let StripHTMLBreakLines = StripHTMLUTF8.replace(/\r?\n|\r/g, "");
    await write_data_pages(link_page, title_page, StripHTMLBreakLines);
  }
};

//Get data from pages and medias
const get_data_from_medias = async () => {
  console.log("get_data_from_medias");
  // loop over each entries to display title
  let medias = await getMedias();

  // loop over each data entries
  for (let media of medias.data) {
    //get source of the media
    let source_media = media.source_url;

    if (source_media.match(/\.[^.]*$/g) == ".pdf") {
      let file_name = source_media.match(/(?<=\/)[^/]*$/g);
      await convert_files_to_base64(file_name, source_media);
    } else {
      console.log("file is not a pdf :" + `${source_media}`);
    }
  }
};

const launch_script = async () => {
  console.log("launch_script");
  await network()
  await delete_inside_temp();
  await create_inside_temp();
  await create_attachment_field();
  await get_data_from_pages();
  await get_data_from_medias();
  await delete_inside();
  await copy_inside_temp_to_inside();
};

launch_script();
