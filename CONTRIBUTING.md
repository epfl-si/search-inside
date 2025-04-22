Contributing
============

Prerequisites
-------------

* Be member of the [Keybase] `/keybase/team/epfl_searchins/` team.
* Be member of the EPFL group `vra_p_svc0012`.


Setup
-----

```bash
git clone git@github.com:epfl-si/search-inside.git
```

Help

```bash
make help
```

Build / Run
-----------

Build Elastic image (locally)

Note: You can set only a restricted list of sites to be indexed within the value of `INSIDE_SITES_TO_INDEX` (comma-delimited) in [docker-compose.elastic-local.yml](docker-compose.elastic-local.yml).

```bash
make build
```

Run with **local** Elastic image

```bash
make local-up
```

Run with **production** Elastic image (built on Openshift)

```bash
make prod-up
```

Deploy
------

```bash
./ansible/elasticsible (--prod for deploy in production environment)
```

**Note:** The builds are made on cloud on OpenShift via BuildConfig on test environment.

## Search Inside API

Start a new build and restart the pods

```bash
./ansible/elasticsible -t api.image.startbuild
./ansible/elasticsible -t api.image.restart
```

## Search Inside Elastic

Start a new build and restart the pods

```bash
./ansible/elasticsible -t elastic.image.startbuild
./ansible/elasticsible -t elastic.image.restart
```

You can also run the Tekton pipeline via elasticsible

```bash
./ansible/elasticsible -t elastic.tekton.run-pipeline
```

or from the OpenShift Console.
