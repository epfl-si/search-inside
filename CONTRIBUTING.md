Contributing
============

Prerequisites
-------------

* Access to the team Keybase /keybase/team/epfl_searchins.
* Access to OpenShift EPFL projects 'wwp-test' and 'wwp'.
* OpenShift CLI [oc](https://docs.openshift.com/container-platform/3.11/cli_reference/get_started_cli.html#installing-the-cli) and [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) installed.


Setup
-----

If you want to build the index locally (which is stored inside the Elastic image), you can define a restricted list of inside sites to be indexed within the value of `INSIDE_SITES_TO_INDEX` (comma-delimited) in [docker-compose.elastic-local.yml](docker-compose.elastic-local.yml).

Otherwise, you can run with production Elastic image from OpenShift who contains the production index data (see 'Build / Run' section).

Build / Run
-----------

Build Elastic image (locally)
`make build[-force]`

Run with **local** Elastic image
`make local-up`

Run with **production** Elastic image (built on Openshift)
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
`./ansible/elasticsible -t api.rebuild`

Promote images  
`./ansible/elasticsible -t images.promote --prod`
