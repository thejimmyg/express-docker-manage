# Express Docker Manage

**CAUTION: Under active development, not suitable for production use for people
outside the development team yet.**


## Config

You configure the container by setting environment variables:

* `DIR` - The directory containing the docker registry data
* `MUSTACHE_DIRS` - A `:` separated list of paths the system should look for mustache templates before using its default ones.
* `DISABLE_AUTH` - Defaults to `false` but can be `true` to make file uploading and downloading work without requiring sign in. Only recommended for development.
* `SCRIPT_NAME` - The base URL at which the app is hosted. Defaults to `""` and must not end with `/`. Usually this is set to something like `/upload`
* `DEBUG` - The loggers you want to see log output for. e.g. `express-docker-manage,express-mustache-jwt-signin`.
* `PORT` - The port you would like the app to run on. Defaults to 80.
* `SECRET` - The secret string used to sign cookies. Make sure this is a long secret that no-one else knows, otherwise they could forge the user information in your cookies. Make sure you set the `SECRET` variable to the same value in the `signin` container too, otherwise they won't recognose each other's cookies.
* `IMAGE_BASE_NAME` - the base name for the location of docker images. It is displayed on the `list` view. e.g. `www.example.localhost/`

## Docker Example

Make sure you have installed Docker and Docker Compose for your platform, and
that you can customise your networking so that `www.example.localhost` can
point to `127.0.0.1`.

Also, make sure you have the source code:

```
git clone https://github.com/thejimmyg/express-docker-manage.git
cd express-docker-manage
```

**Tip: You can also use the published docker image at https://cloud.docker.com/u/thejimmyg/repository/docker/thejimmyg/express-docker-manage if you change the `docker-compose.yml` file to use `image: thejimmyg/express-docker-manage:0.1.4` instead of building from source**

OK, let's begin.

For local testing, let's imagine you want to use the domain `www.example.localhost`.

You can create certificates as described here:

* https://letsencrypt.org/docs/certificates-for-localhost/

You'll need to put them in the directory `domain/www.example.localhost/sni` in this example. Here's some code that does this:

```
mkdir -p domain/www.example.localhost/sni
openssl req -x509 -out domain/www.example.localhost/sni/cert.pem -keyout domain/www.example.localhost/sni/key.pem \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=www.example.localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=www.example.localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:www.example.localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```

Now edit your `/etc/hosts` so that your domain really points to `127.0.0.1` for local testing. You should have a line that looks like this:

```
127.0.0.1	localhost www.example.localhost example.localhost
```

There is already a user file in `users/users.yaml` which the `signin` container can use. Edit it to change the usernames and passwords as you see fit.

**Tip: You can use a hased password too for the `password` field. Just visit `/user/hash` once the example is running to generarte the hash and then update the file.**

Make a directory where you can override the default templates that are in `views`:

```
mkdir -p views-dockermanage
```

Make an `docker` directory where files will be uploaded to:

```
mkdir -p docker
```

You'll end up with a directory structure that looks like `docker/docker/registry/v2/repositories/` if you share the above `docker` directroy with docker registry too.

You can simulate one for testing like this:

```
mkdir -p docker/docker/registry/v2/repositories/test
```

Make sure you change the `SECRET` variable everywhere, otherwise someone could forge your cookies and gain access to your system. You must use the same value for `SECRET` in each of the containers otherwise they won't recognose each other's cookies.

You can now run the containers with:

```
npm run docker:run:local
```

Visit https://www.example.localhost/. You'll probably need to get your browser to accept the certficate since it is a self-signed one, then you'll be asked to sign in using the credentials in `users/users.yml`.

As long as the user you sign in with has the `admin: true` claim in the `users/users.yaml` file, you should be able to view docker registry images.

Make any tweaks to templates in `views-dockermanage` so that the defaults aren't affected. You can copy the defaults in the `views` directory as a starting point, but make sure you keep the same names.

You can also check the `PUBLIC_FILES_DIRS` overlay at https://www.example.localhost/user/public/hello.txt

This example sets up a docker registry running at the same domain as the web interface. The username and password are configured in `docker-compose.yml` and are currently `admin` and `supersecret`.

You can login to it using:

```
docker login www.example.localhost
```

(Internally what is happening is that this makes requests to `www.example.localhost/v2` which `gateway-lite` sets up using basic auth.)

Then you can push and pull docker images with the `www.example.localhost` base.

When you are finished you can stop the containers with the command below, otherwise Docker will automatically restart them each time you reboot (which is what you want in production, but perhaps not when you are developing):

```
npm run docker:stop:local
```



## Example

```
npm install
DISABLE_AUTH=true SIGN_IN_URL=/user/signin SCRIPT_NAME="" DEBUG=express-docker-manage,express-mustache-overlays,express-mustache-jwt-signin DIR=docker PORT=8000 SECRET='reallysecret' npm start
```

Visit http://localhost:8000.

You should be able to make requests to routes restricted with `signedIn`
middleware as long as you have the cookie, or use the JWT in an `Authorization
header like this:

```
Authorization: Bearer <JWT goes here>
```

A good way of organising this is to use `gateway-lite` as your gateway proxying
both to `express-mustache-jwt-signin` and this module. Then you can use
`express-mustache-jwt-signin` to set the cookie that this project can read as
long as the `SECRET` environmrnt variables are the same.

If you just enable `SECRET` but don't set up the proxy, you'll just get
redirected to the `SIGN_IN_URL` (set to `/user/signin` in the example) and see
a 404 page.

## Development

```
npm run fix
```


## Changelog

### 0.1.1 2018-01-02

* Respond to SIGTERM for Docker
* Added `IMAGE_BASE_NAME`

### 0.1.0 2018-12-30

* Initial release
