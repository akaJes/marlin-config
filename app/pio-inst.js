const PIO_CORE_MIN_VERSION = '3.5.2-rc.3';
const STORAGE_STATE_KEY = 'platformio-ide:installer-state';

const pioNodeHelpers = require('platformio-node-helpers');
const StateStorage  = require('./state-storage');

class PythonPrompt {
  constructor() {
    this.STATUS_TRY_AGAIN = 0;
    this.STATUS_ABORT = 1;
    this.STATUS_CUSTOMEXE = 2;
  }
  async prompt(){
    return { status: this.STATUS_ABORT };
  }
}

function installer() {
  var obj = {};
  obj.stateStorage = new StateStorage(STORAGE_STATE_KEY);
  obj.onDidStatusChange = function () { console.log('onDidStatusChange', arguments)}

  var i = new pioNodeHelpers.installer.PlatformIOCoreStage(obj.stateStorage, obj.onDidStatusChange, {
        pioCoreMinVersion: PIO_CORE_MIN_VERSION,
        useBuiltinPIOCore: true,
        setUseBuiltinPIOCore: (value) => console.log('platformio-ide.advanced.useBuiltinPIOCore', value),
        useDevelopmentPIOCore: false,
        pythonPrompt: new PythonPrompt()
      })
  if(process.platform.startsWith('win') && process.env.PATH.indexOf('.platformio') < 0)
	process.env.PATH+=";"+process.env.USERPROFILE+"\\.platformio\\penv\\Scripts;";
  return i;
}
module.exports=installer();
//i.check().then(console.log).catch(console.error);
//installer().install().then(console.log).catch(console.error);
