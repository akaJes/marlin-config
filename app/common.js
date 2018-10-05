const path = require('path');
const fs = require('fs');

const git = require('./git-tool');
const mctool = require('./mc-tool');
const store = require('./store');
const {getFirstFile} = require('./helpers');

const seek4File = (file, paths, rel) =>
  git.root()
  .then(root =>
    getFirstFile(paths.map(i => path.join(root, i, file)))
    .then(res => rel && path.relative(root, res) || res)
  )

const copyFile = (from, to) =>
  new Promise((resolve, reject, stream) => (stream =
    fs.createReadStream(from))
    .on('error', reject)
    .on('open', () =>
      stream.pipe(
        fs.createWriteStream(to)
        .on('finish', () => resolve(to))
        .on('error', reject)
      )
    )
  );

const uploadFiles = files =>
  Promise.all(files.map(file =>
    git.root()
    .then(root => {
      try {
        return mctool
          .makeCfg(file.path)
          .then(mctool.makeHfile(root, file.name, store.state.baseCfg))
          .then(a => file.name)
      } catch(e) {
        console.error(e);
        throw e;
      }
    })
  ))
const configFilesList = ['Configuration.h', 'Configuration_adv.h', '_Bootscreen.h', '_Statusscreen.h'];
const configFilesListUpload = configFilesList.slice(0, 2);

const uploadCopyFiles = files =>
    uploadFiles(files.filter(file => configFilesListUpload.indexOf(file.name) >= 0))
    .then(a => git.root())
    .then(root => Promise.all(
        files.filter(file => configFilesListUpload.indexOf(file.name) < 0).map(f => copyFile(f.path, path.join(root, 'Marlin', f.name)))
    ))

const configFiles = p => Promise.all(configFilesList
      .map(file => seek4File(file, p ? [p.replace(/\\/g, path.sep)] : ['Marlin', path.join('Marlin', 'src', 'config')]).catch(() => null))
  ).then(files => files.filter(a => a));

const getBoards = () =>
  seek4File('boards.h', [ 'Marlin', path.join('Marlin', 'src', 'core')])
  .then(mctool.getBoards);

const getThermistors = () =>
  seek4File('thermistornames.h', ['Marlin', path.join('Marlin', 'src', 'lcd')])
  .then(mctool.getThermistors);

module.exports = {
  seek4File,
  copyFile,
  uploadCopyFiles,
  uploadFiles,
  configFilesList,
  configFilesListUpload,
  configFiles,
  getBoards,
  getThermistors,
}
