import ServerHttp from '../aliapi/server'
import { useAppStore, useFootStore, useSettingStore } from '../store'
import AppCache from '../utils/appcache'
import DownDAL from '../down/DownDAL'
import UploadDAL from '../down/UploadDAL'
import ShareDAL from '../share/share/ShareDAL'

import UserDAL from '../user/userdal'
import DebugLog from '../utils/debuglog'
import PanDAL from '../pan/pandal'

export function PageMain() {
  if (window.WinMsg !== undefined) return
  window.WinMsg = WinMsg
  //useSettingStore().WebSetProxy()
  Promise.resolve()
    .then(async () => {
      DebugLog.mSaveSuccess('小白羊启动')
      await ShareDAL.aLoadFromDB().catch((err: any) => {
        DebugLog.mSaveDanger('ShareDALLDB', err)
      })
      await UserDAL.aLoadFromDB().catch((err: any) => {
        DebugLog.mSaveDanger('UserDALLDB', err)
      })
    })
    .then(async () => {
      /*await DownDAL.aReloadDowning().catch((err: any) => {
        DebugLog.mSaveDanger('aReloadDowning', err)
      })*/ //TODO
      await UploadDAL.aReloadUploading().catch((err: any) => {
        DebugLog.mSaveDanger('aReloadUploading', err)
      })

      /*await DownDAL.aReloadDowned().catch((err: any) => {
        DebugLog.mSaveDanger('aReloadDowned', err)
      })*/ //TODO
      await UploadDAL.aReloadUploaded().catch((err: any) => {
        DebugLog.mSaveDanger('aReloadUploaded', err)
      })

      await AppCache.aLoadCacheSize().catch((err: any) => {
        DebugLog.mSaveDanger('AppCacheDALLDB', err)
      })

      setTimeout(timeEvent, 1000)
    })
    .catch((err: any) => {
      DebugLog.mSaveDanger('LoadSettingFromDB', err)
    })
}

export const WinMsg = function (arg: any) {
  if (arg.cmd == 'MainUploadEvent') {
    UploadDAL.aUploadEvent(arg.ReportList, arg.ErrorList, arg.SuccessList, arg.RunningKeys, arg.SpeedTotal)
  } else if (arg.cmd == 'MainUploadDir') {
    const parentid = arg.parentid as string
    const Info = arg.Info
    UploadDAL.UploadLocalDir(Info.user_id, Info.drive_id, parentid, Info.LocalFilePath)
  } else if (arg.cmd == 'MainSaveAllDir') {
    PanDAL.aReLoadDriveSave(arg.OneDriver, arg.ErrorMessage)
  } else if (arg.cmd == 'MainShowAllDirProgress') {
    useFootStore().mSaveLoading('加载全部文件夹(' + Math.floor((arg.index * 100) / (arg.total + 1)) + '%)')
  }
}

let runTime = Math.floor(Date.now() / 1000)
let chkUpgradeTime1 = Math.floor(Date.now() / 1000)
let chkUpgradeTime2 = Math.floor(Date.now() / 1000)
let chkDirSizeTime = 0
let lockDirSizeTime = false
let chkClearDownLogTime = 0
let chkTokenTime = 0
let chkTaskTime = 0

/**
 * 时间事件，一但被调用每秒执行一次 <br/>
 * 可以理解为定时任务，根据不同的时间节点执行不同的任务
 */
function timeEvent() {
  const settingStore = useSettingStore()

  let nowTime = Math.floor(Date.now() / 1000)


  if (nowTime - runTime > 60 * 60 * 24) {
    runTime = nowTime
    chkDirSizeTime = 0
  }

  if (chkUpgradeTime1 > 0 && nowTime - chkUpgradeTime1 > 360) {
    chkUpgradeTime1 = -1
    ServerHttp.CheckUpgrade(false).catch((err: any) => {
      DebugLog.mSaveDanger('CheckUpgrade', err)
    })
  }
  if (nowTime - chkUpgradeTime2 > 14300) {
    chkUpgradeTime2 = nowTime
    ServerHttp.CheckUpgrade(false).catch((err: any) => {
      DebugLog.mSaveDanger('CheckUpgrade', err)
    })
  }


  if (settingStore.uiFolderSize == true && lockDirSizeTime == false && nowTime - runTime > 50 && chkDirSizeTime >= 10) {
    lockDirSizeTime = true
    PanDAL.aUpdateDirFileSize()
      .catch((err: any) => {
        DebugLog.mSaveDanger('aUpdateDirFileSize', err)
      })
      .then(() => {
        chkDirSizeTime = 0
        lockDirSizeTime = false
      })
  } else chkDirSizeTime++


  chkClearDownLogTime++
  if (nowTime - runTime > 60 && chkClearDownLogTime >= 540) {
    chkClearDownLogTime = 0
    UploadDAL.aClearUploaded().catch((err: any) => {
      DebugLog.mSaveDanger('aClearUploaded ', err)
    })
    /*DownDAL.aClearDowned().catch((err: any) => {
      DebugLog.mSaveDanger('aClearDowned ', err)
    })*/ //TODO
  }


  chkTokenTime++
  if (nowTime - runTime > 10 && chkTokenTime >= 600) {
    chkTokenTime = 0
    UserDAL.aRefreshAllUserToken().catch((err: any) => {
      DebugLog.mSaveDanger('aRefreshAllUserToken', err)
    })
  }


  chkTaskTime++
  if (nowTime - runTime > 6 && chkTaskTime >= 2) {
    chkTaskTime = 0
    useFootStore().aUpdateTask()
  }


  DownDAL.aSpeedEvent().catch((err: any) => {
    DebugLog.mSaveDanger('aSpeedEvent', err)
  })

  // 没有下载和上传时触发自动关闭
  if (settingStore.downAutoShutDown == 2) {
    if (!DownDAL.QueryIsDowning() && !UploadDAL.QueryIsUploading()) {
      settingStore.downAutoShutDown = 0
      useAppStore().appShutDown = true
    }
  }

  setTimeout(timeEvent, 1000)
}
