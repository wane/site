import * as fs from 'fs-extra'
import * as glob from 'glob'
import chalk from 'chalk'

async function main () {
  try {
    await prepareDistFolder()
    await buildAll()
    console.info(chalk.bold.bgGreenBright.white(`Build completed.`))
  } catch (error) {
    console.error(chalk.bold.bgRedBright.white(`Build failed.`))
    console.error(chalk.red(error))
  }
}

async function prepareDistFolder () {
  if (fs.existsSync('dist')) {
    const files = glob.sync('dist/**/*')
    files.forEach(file => fs.removeSync(file))
  } else {
    fs.mkdirSync('dist')
  }
}

async function buildAll () {
  return Promise.all([
    buildHtml(),
    buildJavaScript(),
    buildStyles(),
    buildAssets(),
  ])
}

async function buildHtml () {
  fs.copySync('src/index.html', 'dist/index.html')
}

async function buildJavaScript () {
  fs.copySync('src/index.js', 'dist/index.js')
}

async function buildStyles () {
  fs.copySync('src/styles.css', 'dist/styles.css')
}

async function buildAssets () {
  fs.copySync('src/logo.svg', 'dist/logo.svg')
}

main()
