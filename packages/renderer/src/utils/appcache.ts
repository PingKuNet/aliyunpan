import { useSettingStore } from '@/store'
//import { AriaShoutDown } from './aria2c'
import DebugLog from './debuglog'
import { humanSize, Sleep } from './format'
import message from './message'
import { app } from '@electron/remote'
import path from 'path'
import fsPromises from 'fs/promises'

export default class AppCache {
  
  static AppUserData = ''
  
  static AppAsarPath = ''
  /** win32 darwin linux */
  static AppPlatform = ''
  /** 'arm', 'arm64', 'ia32', 'mips', 'x32','x64' */
  static AppArch = ''
  
  static AppExecPath = ''

  
  static LoadCache() {
    if (!AppCache.AppUserData) {
      AppCache.AppAsarPath = app.getAppPath()
      AppCache.AppUserData = app.getPath('userData')
      AppCache.AppPlatform = process.platform
      AppCache.AppArch = process.arch
      AppCache.AppExecPath = process.execPath
    }
  }

  
  static async LoadDirSize(dir: string) {
    try {
      const childfiles = await fsPromises.readdir(dir, { withFileTypes: true }).catch((e: any) => {
        if (e.code && e.code === 'EPERM') {
          e = '没有权限访问文件夹'
          message.error('没有权限访问文件夹：' + dir)
        }
        if (e.message) e = e.message
        if (typeof e == 'string' && e.indexOf('EACCES') >= 0) message.error('没有权限访问文件夹：' + dir)
        DebugLog.mSaveLog('danger', 'LoadDirSize失败：' + dir + ' ' + (e || ''))
        return []
      })
      let total = 0
      for (let i = 0, maxi = childfiles.length; i < maxi; i++) {
        if (childfiles[i].isFile()) {
          
          const stat = await fsPromises.lstat(path.join(dir, childfiles[i].name)).catch((e: any) => {
            return { size: 0 }
          })
          total += stat.size
        } else if (childfiles[i].isDirectory()) {
          
          total += await AppCache.LoadDirSize(path.join(dir, childfiles[i].name))
        }
      }
      return total
    } catch {
      return 0
    }
  }

  static DeleteDir(dir: string): Promise<void> {
    return fsPromises
      .rm(dir, { force: true, recursive: true })
      .then(() => {})
      .catch(() => {})
  }

  
  static async aLoadCacheSize() {
    AppCache.LoadCache()
    if (!AppCache.AppUserData) return
    const dirsize = await AppCache.LoadDirSize(AppCache.AppUserData)
    if (dirsize > 800 * 1024 * 1024) message.warning('缓存文件夹体积较大，该去 设置 里清理了')

    useSettingStore().debugCacheSize = humanSize(dirsize) 
  }

  
  static async aClearCache(delby: string) {
    AppCache.LoadCache()
    const dir = AppCache.AppUserData
    //await AppCache.DeleteDir(path.join(dir, 'Cache'))
    if (delby == 'all') {
      //window.WebClearCache({ cache: true })
      if (window.WebClearCache)
        window.WebClearCache({
          storages: [`appcache`, `cookies`, `filesystem`, `shadercache`, `serviceworkers`, `cachestorage`, `indexdb`, `localstorage`, `websql`],
          quotas: [`temporary`, `persistent`, `syncable`]
        })
    } else {
      //window.WebClearCache({ cache: true })
      if (window.WebClearCache)
        window.WebClearCache({
          storages: [`appcache`, `cookies`, `filesystem`, `shadercache`, `serviceworkers`, `cachestorage`],
          quotas: [`temporary`, `persistent`, `syncable`]
        })
    }
    if (delby == 'all') {
      await AppCache.DeleteDir(path.join(dir, 'databases')).catch(() => {})
      await AppCache.DeleteDir(path.join(dir, 'IndexedDB')).catch(() => {})
      await AppCache.DeleteDir(path.join(dir, 'Local Storage')).catch(() => {})
      await AppCache.DeleteDir(path.join(dir, 'Session Storage')).catch(() => {})
    } else if (delby == 'db') {
      await AppCache.DeleteDir(path.join(dir, 'databases')).catch(() => {})
    }
    await AppCache.DeleteDir(path.join(dir, 'Code Cache', 'js')).catch(() => {})
    await AppCache.DeleteDir(path.join(dir, 'Code Cache', 'wasm')).catch(() => {})

    await Sleep(4000)

    //AriaShoutDown()
    if (delby == 'all') {
      message.success('删除全部数据成功，自动重启小白羊')
      Sleep(3000).then(() => {
        window.WebRelaunch()
      })
    } else if (delby == 'db') {
      message.success('删除数据库成功，自动重启小白羊')
      Sleep(3000).then(() => {
        window.WebRelaunch()
      })
    } else {
      message.success('清理缓存成功，自动重启小白羊')
      Sleep(3000).then(() => {
        //window.WebReload()
        window.WebRelaunch()
      })
    }
  }
}
