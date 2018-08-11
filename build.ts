import * as fs from 'fs-extra'
import * as util from 'util'
import * as path from 'path'
import * as glob from 'glob'
import chalk from 'chalk'
import gzipSize from 'gzip-size'
// @ts-ignore (https://github.com/erwinmombay/brotli-size/pull/6)
import brotliSize from 'brotli-size'
import formatNumber from 'format-number'
import { getBorderCharacters, table, TableUserConfig } from 'table'
// @ts-ignore
import * as prompt from 'prompt'
import _ from 'lodash'
// @ts-ignore
import isTravis from 'is-travis'

async function confirm (question: string, positive: Function, negative: Function): Promise<void> {

  if (isTravis) {
    console.info(`In Travis environment, all answers are "no" to avoid accidental overwriting.`)
    negative()
    return
  }

  prompt.start()

  const { answer } = await util.promisify(prompt.get)({
    properties: {
      answer: {
        message: question,
      },
    },
  })

  if (answer.toLowerCase() == 'y') {
    positive()
  } else {
    negative()
  }

}

const tableOptions = (borderStyle: (s: string) => string, columns: number): TableUserConfig => ({
  columnDefault: {
    alignment: 'right',
    paddingLeft: 2,
    paddingRight: 0,
  },
  columns: {
    0: {
      alignment: 'left',
      paddingRight: 1,
    },
    [columns - 1]: {
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

const sourceFolder = 'src'
const distFolder = 'dist'

async function main () {
  try {
    await prepareFolder(distFolder)
    await buildAll(sourceFolder, distFolder)
    const sizes = await computeSizes('dist')
    console.info(await getPrettyTable(sizes as any))
    await assertSizes('sizes.json', 'dist', sizes)
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
  fs.copySync(`${sourceFolder}/index.html`, `${distFolder}/index.html`)
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

interface Sizes {
  raw: number
  gzip: number
  brotli: number
}

async function computeSizes (folder: string) {
  const files = glob.sync(`${folder}/**/*`)
  const result: Record<string, Sizes> = {}
  const total: Sizes = { raw: 0, gzip: 0, brotli: 0 }

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

function toTable<T> (data: Record<string, Record<string, T>>,
                     rowNameTransform: (str: string) => string = s => s,
                     colNameTransform: (str: string) => string = s => s,
                     dataTransform: (t: T, colName: string, rowName: string) => string = s => s.toString(),
): Array<Array<string>> {
  const rowNames = Object.keys(data)
  let columnNames: string[] = []

  const tableData = rowNames.map(rowName => {
    const rowData = data[rowName]
    columnNames = Object.keys(rowData)
    return [
      rowNameTransform(rowName),
      ...columnNames.map(columnName => {
        const cellData = rowData[columnName]
        return dataTransform(cellData, columnName, rowName)
      }),
    ]
  })

  tableData.unshift(['', ...columnNames.map(x => colNameTransform(x))])

  return tableData
}

async function getPrettyTable<T> (data: Record<string, Record<string, number>>): Promise<string> {
  const borderStyle = chalk.white
  const columnNameStyle = chalk.bold
  const rowNameStyle = chalk.gray.bold

  const tableData = toTable(data, rowNameStyle, columnNameStyle, s => formatNumber()(s))

  // Mark last as bold
  const lastRow = tableData[tableData.length - 1]
  lastRow[lastRow.length - 1] = chalk.bold(lastRow[lastRow.length - 1])

  return table(tableData, tableOptions(borderStyle, 4))
}

async function assertSizes (sizesSnapshotPath: string, folder: string, sizes: Record<string, Sizes>) {
  try {
    const { ['default']: snapshot } = await import(`./${sizesSnapshotPath}`)

    const oldFiles = Object.keys(snapshot).filter(name => name != 'total')
    const newFiles = Object.keys(sizes).filter(name => name != 'total')

    const removedFiles = _.difference(oldFiles, newFiles)
    const addedFiles = _.difference(newFiles, oldFiles)
    const overlappingFiles = _.intersection(newFiles, oldFiles)

    const sizeDiff: Record<string, Sizes> = {}
    overlappingFiles.forEach(file => {
      const oldSize = snapshot[file] as Sizes
      const newSize = sizes[file]
      const diff = {
        raw: newSize.raw - oldSize.raw,
        gzip: newSize.gzip - oldSize.gzip,
        brotli: newSize.brotli - oldSize.brotli,
      }
      const hasChange = (diff.raw != 0 || diff.gzip != 0 || diff.brotli != 0)
      if (hasChange) {
        sizeDiff[file] = diff
      }
    })

    const hasIncrease = Object.keys(sizeDiff).some(file => {
      const size = sizeDiff[file]
      return size.raw > 0 || size.gzip > 0 || size.brotli > 0
    })

    const hasDecrease = Object.keys(sizeDiff).some(file => {
      const size = sizeDiff[file]
      return size.raw < 0 || size.gzip < 0 || size.brotli < 0
    })

    const data: Record<string, Record<'rawOld' | 'rawNew' | 'rawDiff' | 'gzipOld' | 'gzipNew' | 'gzipDiff' | 'brotliOld' | 'brotliNew' | 'brotliDiff', number>> = {}
    removedFiles.forEach(file => {
      data[file] = {
        rawOld: snapshot[file].raw,
        rawNew: 0,
        rawDiff: -snapshot[file].raw,
        gzipOld: snapshot[file].gzip,
        gzipNew: 0,
        gzipDiff: -snapshot[file].gzip,
        brotliOld: snapshot[file].brotli,
        brotliNew: 0,
        brotliDiff: -snapshot[file].brotli,
      }
    })
    addedFiles.forEach(file => {
      data[file] = {
        rawOld: 0,
        rawNew: sizes[file].raw,
        rawDiff: sizeDiff[file].raw,
        gzipOld: 0,
        gzipNew: sizes[file].gzip,
        gzipDiff: sizeDiff[file].gzip,
        brotliOld: 0,
        brotliNew: sizes[file].brotli,
        brotliDiff: sizeDiff[file].brotli,
      }
    })
    Object.keys(sizeDiff).forEach(file => {
      data[file] = {
        rawOld: snapshot[file].raw,
        rawNew: sizes[file].raw,
        rawDiff: sizeDiff[file].raw,
        gzipOld: snapshot[file].gzip,
        gzipNew: sizes[file].gzip,
        gzipDiff: sizeDiff[file].gzip,
        brotliOld: snapshot[file].brotli,
        brotliNew: sizes[file].brotli,
        brotliDiff: sizeDiff[file].brotli,
      }
    })
    const f = formatNumber()
    const sizesTable = toTable(data, chalk.gray, chalk.bold, (n, rowName) => {
      if (!rowName.endsWith('Diff')) return f(n)
      if (n > 0) {
        return chalk.red.bold(f(n))
      } else if (n < 0) {
        return chalk.green(f(n))
      } else {
        return chalk.gray(f(n))
      }
    })

    if (addedFiles.length == 0 && removedFiles.length == 0 && !hasIncrease && !hasDecrease) {
      console.info(`No change in bundle size (${formatNumber({ suffix: 'b' })(sizes['total'].brotli)}).`)
    } else {
      const prettyTable = table(sizesTable, tableOptions(chalk.white, 10))
      if (addedFiles.length > 0 || hasIncrease) {
        console.log(`Bundle size ${chalk.bold.bgRedBright.whiteBright('increased')}. Review the table below and choose if this is OK.`)
        console.log(prettyTable)
        await confirm(`Do you want to update the snapshot? (y/N)`, () => {
          fs.writeFileSync(sizesSnapshotPath, JSON.stringify(sizes, null, 2), 'utf8')
        }, () => {
          throw new Error(`Bundle size increased.`)
        })
      } else {
        console.info(`Bundle size ${chalk.bold.bgGreen.whiteBright('decreased')}. Review the table below and choose if this is OK.`)
        console.log(prettyTable)
        await confirm(`Do you want to update the snapshot? (y/N)`, () => {
          fs.writeFileSync(sizesSnapshotPath, JSON.stringify(sizes, null, 2), 'utf8')
        }, () => {
          throw new Error(`Bundle size increased.`)
        })
      }
    }
  } catch (e) {
    if (/Cannot find module/.test(e.message)) {
      console.info(`Cannot open snapshots.`)
      await confirm(`Do you want to create a snapshot? (y/N)`, () => {
        fs.writeFileSync(sizesSnapshotPath, JSON.stringify(sizes, null, 2), 'utf8')
      }, () => {
        console.info(`Snapshot not saved.`)
        throw new Error(`No snapshot to compare sizes with.`)
      })
    } else {
      throw e
    }
  }
}

main()
