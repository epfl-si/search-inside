Contributing
============

Prerequisites
-------------

* Access to the team Keybase /keybase/team/epfl_searchins.
* Access to OpenShift EPFL projects 'wwp-test' and 'wwp'.
* OpenShift CLI [oc](https://docs.openshift.com/container-platform/3.11/cli_reference/get_started_cli.html#installing-the-cli) and [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) installed.


Setup
-----

If you want to build the index locally (who is stored inside the Elastic image), it's better to crawl website(s) from local WordPress instance (see [wp-dev](https://github.com/epfl-si/wp-dev/)) to avoid API access permissions issues. Adapt following environment variables in [docker-compose.elastic-local.yml](docker-compose.elastic-local.yml):  
  * `INSIDE_HOST` (inside url, 1st level)
  * `INSIDE_HOST_HEADER_HOST`
  * `INSIDE_SITES_TO_INDEX` (comma-delimited sites to index)

Otherwise, you can run with production Elastic image from OpenShift who contains the production index data (see 'Build / Run' section).

Build / Run
-----------

Run with **local** Elastic image  
`make local-up`

Run with **production** Elastic image  
`make prod-up`

Deploy
------

Connect to OpenShift  
`oc login https://pub-os-exopge.epfl.ch --username $(whoami)`

Run elasticsible  
`./ansible/elasticsible` (add `-- prod` for deploy in prod)

Rebuild Elastic image  
`./ansible/elasticsible -t elastic.rebuild`

Rebuild NodeJS API image  
`./ansible/elasticsible -t nodeapi.rebuild`

Promote images  
`./ansible/elasticsible -t images.promote --prod`
