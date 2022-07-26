Contributing
============

Prerequisites
-------------

* Access to the team Keybase /keybase/team/epfl_searchins.
* Access to OpenShift EPFL projects 'wwp-test' and 'wwp'.
* OpenShift CLI (oc) and Ansible installed.


Build / Run
-----------

Run with local Elastic image  
`make local-up`

Run with production Elastic image  
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
