import ServerHttp from '@/aliapi/server'
import { useAppStore, useFootStore, useSettingStore } from '@/store'
import AppCache from '@/utils/appcache'
import DownDAL from '@/down/DownDAL'
import UploadDAL from '@/down/UploadDAL'
import ShareDAL from '@/share/share/ShareDAL'
import { UploadEvent } from '@/down/UploadService'
import UserDAL from '@/user/userdal'
import DebugLog from '@/utils/debuglog'

export function PageMain() {
  if (window.WinMsg !== undefined) return
  window.WinMsg = WinMsg
  useSettingStore()
  Promise.resolve()
    .then(async () => {
      DebugLog.mSaveLog('success', '小白羊启动')
      await ShareDAL.aLoadFromDB().catch((e: any) => {
        DebugLog.mSaveLog('danger', 'ShareDALLDB' + e.message)
      })
      await UserDAL.aLoadFromDB().catch((e: any) => {
        DebugLog.mSaveLog('danger', 'UserDALLDB' + e.message)
      })
    })
    .then(async () => {
      //await SQL.ClearOldLogs(useSettingStore().debugDownedListMax).catch(() => {})
      await DownDAL.aLoadFromDB().catch((e: any) => {
        DebugLog.mSaveLog('danger', 'DownDALLDB' + e.message)
      })
      await UploadDAL.aLoadFromDB().catch((e: any) => {
        DebugLog.mSaveLog('danger', 'UploadDALLDB' + e.message)
      })


      await AppCache.aLoadCacheSize().catch((e: any) => {
        DebugLog.mSaveLog('danger', 'AppCacheDALLDB' + e.message)
      })

      setTimeout(timeEvent, 1000)
    })
    .catch((e: any) => {
      DebugLog.mSaveLog('danger', 'LoadSettingFromDB' + e.message)
    })
}

export const WinMsg = function (arg: any) {
  if (arg.cmd == 'MainUploadEvent') {
    UploadDAL.aUploadEvent(arg.list || [])
  } else if (arg.cmd == 'MainUploadDir') {
    const parentid = arg.parentid as string
    const Info = arg.Info
    UploadDAL.UploadLocalDir(Info.userid, Info.drive_id, parentid, Info.localFilePath)
  } else if (arg.cmd == 'MainUploadID') {
    UploadDAL.mSaveToUploading(arg.UploadID, arg.file_id, arg.upload_id)
  }
}

let runTime = 0

/**
 * 时间事件，一但被调用每秒执行一次 <br/>
 * 可以理解为定时任务，根据不同的时间节点执行不同的任务
 */
function timeEvent() {
  const settingStore = useSettingStore()

  runTime++

  // 一天后进入
  if (runTime > 60 * 60 * 24) runTime = 0

  // 5分钟后进入，？或者在每次近8小时的时候进入？
  if (runTime == 300 || runTime % 14400 == 14300) {
    ServerHttp.CheckUpgrade(false)
  }

  // 6秒后每2秒进入（计秒为双数）
  if (runTime > 6 && runTime % 2 == 0) {
    /*
    PanDAL.UpdateDirSize().catch((e: any) => {
      DebugLog.mSaveLog('danger', 'UpdateDirSize' + e.message)
    })
    */
  }

  // 6秒后每20秒进入
  if (runTime > 6 && runTime % 20 == 0) {
    //SQL.ClearOldLogs(settingStore.debugDownedListMax)
  }

  // 6秒后每1小时进入
  if (runTime > 6 && runTime % 600 == 0) {
    UserDAL.aRefreshAllUserToken()
  }

  // 6秒后计秒为单数进入（每2秒进入）
  if(runTime > 6 && runTime % 2 == 1){
    useFootStore().aUpdateTask()
  }

  DownDAL.aSpeedEvent().catch((e: any) => {
    DebugLog.mSaveLog('danger', 'aSpeedEvent' + e.message)
  })

  UploadEvent().catch((e: any) => {
    DebugLog.mSaveLog('danger', 'UploadEvent' + e.message)
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
