import * as fs from 'fs-extra'
import * as path from 'path'
import * as util from 'util'
import * as glob from 'glob'
import chalk from 'chalk'
import gzipSize from 'gzip-size'
import brotliSize from 'brotli-size'
import formatNumber from 'format-number'
import { getBorderCharacters, table } from 'table'
// @ts-ignore
import validateHtml from 'html-tag-validator'

const sourceFolder = 'src'
const distFolder = 'dist'

async function main () {
  try {
    await prepareFolder(distFolder)
    await buildAll(sourceFolder, distFolder)
    console.info(await getPrettyTable(await computeSizes('dist')))
    console.info(chalk.bold.bgGreenBright.whiteBright(`Build completed.`))
  } catch (error) {
    console.error(chalk.bold.bgRedBright.whiteBright(`Build failed.`))
    console.error(chalk.red(error))
  }
}

async function prepareFolder (dirName: string) {
  if (fs.existsSync(dirName)) {
    const files = glob.sync(`${dirName}/**/*`)
    files.forEach(file => fs.removeSync(file))
  } else {
    fs.mkdirSync(dirName)
  }
}

async function buildAll (sourceFolder: string, distFolder: string) {
  return Promise.all([
    buildHtml(sourceFolder, distFolder),
    buildJavaScript(sourceFolder, distFolder),
    buildStyles(sourceFolder, distFolder),
    buildAssets(sourceFolder, distFolder),
  ])
}

async function buildHtml (sourceFolder: string, distFolder: string) {
  const sourceFilePath = `${sourceFolder}/index.html`
  const sourceFileContent = fs.readFileSync(sourceFilePath, 'utf-8')
  try {
    const result = await util.promisify(validateHtml)(sourceFileContent)
    console.log(result)
    fs.copySync(sourceFilePath, `${distFolder}/index.html`)
  } catch (e) {
    console.error(e)
  }
}

async function buildJavaScript (sourceFolder: string, distFolder: string) {
  fs.copySync(`${sourceFolder}/index.js`, `${distFolder}/index.js`)
}

async function buildStyles (sourceFolder: string, distFolder: string) {
  fs.copySync(`${sourceFolder}/styles.css`, `${distFolder}/styles.css`)
}

async function buildAssets (sourceFolder: string, distFolder: string) {
  fs.copySync(`${sourceFolder}/logo.svg`, `${distFolder}/logo.svg`)
}

async function computeSizes (folder: string) {
  const files = glob.sync(`${folder}/**/*`)
  const result: Record<string, { raw: number, gzip: number, brotli: number }> = {}
  const total: ValueOf<typeof result> = { raw: 0, gzip: 0, brotli: 0 }

  files.forEach(file => {
    const fileContent = fs.readFileSync(file)
    const raw = fileContent.byteLength
    const gzip = gzipSize.sync(fileContent)
    const brotli = brotliSize.sync(fileContent)
    result[path.basename(file)] = { raw, gzip, brotli }
    total.raw += raw
    total.gzip += gzip
    total.brotli += brotli
  })

  result['total'] = total

  return result
}

async function getPrettyTable<T> (data: Record<string, Record<string, number>>): Promise<string> {
  const f = formatNumber()

  const rowNames = Object.keys(data)
  let columnNames: string[] = []

  const borderStyle = chalk.white
  const columnNameStyle = chalk.bold
  const rowNameStyle = chalk.gray.bold

  const tableData = rowNames.map(rowName => {
    const rowData = data[rowName]
    columnNames = Object.keys(rowData)
    return [
      rowNameStyle(rowName),
      ...columnNames.map(columnName => {
        const cellData = rowData[columnName]
        return f(cellData)
      }),
    ]
  })

  tableData.unshift(['', ...columnNames.map(x => columnNameStyle(x))])

  // Mark last as bold
  const lastRow = tableData[tableData.length - 1]
  lastRow[lastRow.length - 1] = chalk.bold(lastRow[lastRow.length - 1])

  return table(tableData, {
    columnDefault: {
      alignment: 'right',
      paddingLeft: 3,
      paddingRight: 0,
    },
    columns: {
      0: {
        alignment: 'left',
        paddingRight: 1,
      },
      3: {
        paddingRight: 3,
      },
    },
    border: {
      ...getBorderCharacters('void'),

      topBody: borderStyle('═'),
      topLeft: borderStyle('╔'),
      topRight: borderStyle('╗'),

      bottomBody: borderStyle('═'),
      bottomLeft: borderStyle('╚'),
      bottomRight: borderStyle('╝'),

      bodyLeft: borderStyle('║'),
      bodyRight: borderStyle('║'),

      joinLeft: borderStyle('╟'),
      joinRight: borderStyle('╢'),

      joinBody: borderStyle('─'),
    },
    drawHorizontalLine: (index, size) => {
      return [0, 1, size - 1, size].includes(index)
    },
  })
}

main()
