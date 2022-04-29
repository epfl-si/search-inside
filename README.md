# search-inside

A POC (proof of concept) to check if it is possible to search the pages and media of the EPFL inside pages.  
First, it was done locally on a Synology NAS with docker and then we switched to openshift and ansible.  
  
The goal is to put the content of the pages and media (e.g. PDF) in elasticsearch database and then do a search and find all the pages and media that contain this word.  
  
  
## Table of Contents
1. [Ansible](README.md#Ansible)
2. [Push_to_elasticsearch.js](README.md#Push_to_elasticsearch.js)

## Ansible

The **elasticsible** file allows to create the environment for the application in Openshift  

## Push_to_elasticsearch.js

The script needs axios, html_entities and request dependencies to work.  

First, we do a **delete of inside_temp** which contains an old version of the database.   
Then we **create inside_temp** to make sure it doesn't contain anything.  

We **take the content of the pages and media from the Wordpress REST API**  
  
- Pages:  
  
We take the content of the pages and remove the HTML tags and unnecessary line breaks.  
  
- Medias:  
  
We take the media and encode it to base64 to take its content.  
  
After that, we **delete inside** to avoid duplicates or unnecessary entries and **copy the contents of inside_temp into inside.**
