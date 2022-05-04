Contributing
============

Prerequisite
------------
 
* Access to OpenShift EPFL projects 'wwp-test' and 'wwp'.


Build / Run (locally)
---------------------

```bash
make up
```

Deploy
------

1. `oc login --username <username>`
2. `./ansible/elasticsible` (`--prod` for deploy in production environment)
