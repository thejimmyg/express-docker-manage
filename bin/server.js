const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const debug = require('debug')('express-docker-manage')
const express = require('express')
const fs = require('fs')
const path = require('path')
const { prepareMustacheOverlays, setupErrorHandlers } = require('express-mustache-overlays')
const shell = require('shelljs')
const { setupMiddleware } = require('express-mustache-jwt-signin')
const { promisify } = require('util')

const lstatAsync = promisify(fs.lstat)

const port = process.env.PORT || 80
const scriptName = process.env.SCRIPT_NAME || ''
if (scriptName.endsWith('/')) {
  throw new Error('SCRIPT_NAME should not end with /.')
}
const dockerDir = process.env.DIR
if (!dockerDir) {
  throw new Error('No DIR environment variable set to specify the path of the docker registry data.')
}
const secret = process.env.SECRET
const signInURL = process.env.SIGN_IN_URL || '/user/signin'
const signOutURL = process.env.SIGN_OUT_URL || '/user/signout'
const disableAuth = ((process.env.DISABLE_AUTH || 'false').toLowerCase() === 'true')
if (!disableAuth) {
  if (!secret || secret.length < 8) {
    throw new Error('No SECRET environment variable set, or the SECRET is too short. Need 8 characters')
  }
  if (!signInURL) {
    throw new Error('No SIGN_IN_URL environment variable set')
  }
} else {
  debug('Disabled auth')
}
const mustacheDirs = process.env.MUSTACHE_DIRS ? process.env.MUSTACHE_DIRS.split(':') : []
const publicFilesDirs = process.env.PUBLIC_FILES_DIRS ? process.env.PUBLIC_FILES_DIRS.split(':') : []
const publicURLPath = process.env.PUBLIC_URL_PATH || scriptName + '/public'
const listTitle = process.env.LIST_TITLE || 'Docker Images'
const imageBaseName = process.env.IMAGE_BASE_NAME || ''

const main = async () => {
  const app = express()
  app.use(cookieParser())

  const overlays = await prepareMustacheOverlays(app, { scriptName, publicURLPath })

  app.use((req, res, next) => {
    debug('Setting up locals')
    res.locals = Object.assign({}, res.locals, { publicURLPath, scriptName, title: 'Express Edit Text', signOutURL: signOutURL, signInURL: signInURL })
    next()
  })

  let { signedIn, withUser, hasClaims } = await setupMiddleware(app, secret, { overlays, signOutURL, signInURL })
  if (disableAuth) {
    signedIn = function (req, res, next) {
      debug(`signedIn disabled by DISBABLE_AUTH='true'`)
      next()
    }
    hasClaims = function () {
      return function (req, res, next) {
        debug(`hasClaims disabled by DISBABLE_AUTH='true'`)
        next()
      }
    }
  } else {
    app.use(withUser)
  }

  overlays.overlayMustacheDir(path.join(__dirname, '..', 'views'))
  overlays.overlayPublicFilesDir(path.join(__dirname, '..', 'public'))

  // Set up any other overlays directories here
  mustacheDirs.forEach(dir => {
    debug('Adding mustache dir', dir)
    overlays.overlayMustacheDir(dir)
  })
  publicFilesDirs.forEach(dir => {
    debug('Adding publicFiles dir', dir)
    overlays.overlayPublicFilesDir(dir)
  })

  app.use(bodyParser.urlencoded({ extended: true }))
  app.get(scriptName, signedIn, async (req, res, next) => {
    try {
      debug('Edit / handler')
      const ls = shell.ls(path.join(dockerDir, 'docker', 'registry', 'v2', 'repositories'))
      if (shell.error()) {
        throw new Error('Could not list ' + dockerDir)
      }
      const files = []
      for (let dirname of ls) {
        const stat = await lstatAsync(path.join(dockerDir, 'docker', 'registry', 'v2', 'repositories', dirname))
        if (stat.isDirectory()) {
          files.push({ name: dirname })
        }
      }
      res.render('list', { imageBaseName, title: listTitle, files })
    } catch (e) {
      debug(e)
      next(e)
    }
  })

  await overlays.setup()

  setupErrorHandlers(app)

  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()

// Better handling of SIGINT and SIGTERM for docker
process.on('SIGINT', function () {
  console.log('Received SIGINT. Exiting ...')
  process.exit()
})

process.on('SIGTERM', function () {
  console.log('Received SIGTERM. Exiting ...')
  process.exit()
})
