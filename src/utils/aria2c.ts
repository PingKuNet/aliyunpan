import AliFile from '../aliapi/file'
import AliDirFileList, { IAliFileResp } from '../aliapi/dirfilelist'

import Aria2 from 'aria2-lib'
import axios from 'axios'
import DownDAL, { IAriaDownProgress, IStateDownFile } from '../down/DownDAL'
import message from './message'
import UserDAL from '../user/userdal'
import { useSettingStore } from '../store'
import DebugLog from './debuglog'
import Config from './config'
import AliTrash from '../aliapi/trash'

import path from 'path'
import fsPromises from 'fs/promises'
import fs from 'fs'

const localPwd = 'S4znWTaZYQi3cpRNb'

let Aria2cChangeing: boolean = false
let Aria2EngineLocal: Aria2 | undefined = undefined
let Aria2EngineRemote: Aria2 | undefined = undefined

let IsAria2cOnlineLocal: boolean = false

let Aria2cLocalRelanchTime = 0

let IsAria2cOnlineRemote: boolean = false

let Aria2cRemoteRetryTime = 0

function GetAria() {
  if (useSettingStore().AriaIsLocal) return Aria2EngineLocal
  return Aria2EngineRemote
}

function SetAriaOnline(isOnline: boolean, ariaState: string = '') {
  if (!ariaState) ariaState = useSettingStore().ariaState
  let doc = document.getElementById('footAria')
  if (ariaState == 'local') {
    IsAria2cOnlineLocal = isOnline
    /*if (doc && doc.innerText != '') doc.innerText = ''*/
    if (isOnline) {
      let txt = 'Aria ⚯ Local'
      if (doc && doc.innerText != txt) doc.innerText = txt
    } else {
      if (doc && doc.innerText != 'Aria 已断开') doc.innerText = 'Aria 已断开'
    }
  } else {
    IsAria2cOnlineRemote = isOnline
    if (isOnline) {
      let txt = 'Aria ⚯ ' + (Aria2EngineRemote?.host || '')
      if (doc && doc.innerText != txt) doc.innerText = txt
    } else {
      if (doc && doc.innerText != 'Aria 已断开') doc.innerText = 'Aria 已断开'
    }
  }
}

function CloseRemote() {
  if (IsAria2cOnlineRemote) {
    IsAria2cOnlineRemote = false
    if (Aria2EngineRemote) {
      try {
        Aria2EngineRemote.close().catch().then()
      } catch {}
      Aria2EngineRemote = undefined
    }
  }
}

export function IsAria2cRemote(){
  return IsAria2cOnlineRemote
}

export async function AriaTest(https: boolean, host: string, port: number, secret: string) {
  const url = (https ? 'https://' : 'http://') + host + ':' + port.toString() + '/jsonrpc'
  return axios
    .post(
      url,
      { method: 'aria2.getGlobalStat', jsonrpc: '2.0', id: 'id' + Date.now(), params: ['token:' + secret] },
      {
        responseType: 'json',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 4000
      }
    )
    .then(() => {
      return true
    })
    .catch(function (error) {
      if (error.response && error.response.data && error.response.data.error) {
        if (error.response.data.error.message == 'Unauthorized') {
          message.error('连接失败 密码错误 ' + url + ' secret=' + secret)
          return false
        }
      }
      if (error.message && error.message.indexOf('timeout of') >= 0) {
        message.error('连接失败 网络连接超时 ' + url)
        return false
      }
      message.error('连接失败 ' + (error.message ? error.message : '') + ' ' + url + ' secret=' + secret)
      return false
    })
}
function Sleep(msTime: number) {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          success: true,
          time: msTime
        }),
      msTime
    )
  )
}


export async function AriaChangeToRemote() {
  if (Aria2cChangeing) return undefined
  Aria2cChangeing = true
  CloseRemote()
  try {
    const settingStore = useSettingStore()
    const host = settingStore.ariaUrl.split(':')[0]
    const port = parseInt(settingStore.ariaUrl.split(':')[1])
    const secret = settingStore.ariaPwd

    const options = { host, port, secure: settingStore.ariaHttps, secret, path: '/jsonrpc' }
    Aria2EngineRemote = new Aria2({ WebSocket: global.WebSocket, fetch: global.fetch, ...options })

    Aria2EngineRemote.on('close', () => {
      if (IsAria2cOnlineRemote && !Aria2cChangeing) {
        if (!settingStore.AriaIsLocal) {
          message.error('Aria2远程连接已断开')
          SetAriaOnline(false, 'remote')
        }
      }
    })
    await Sleep(500)
    await Aria2EngineRemote.open()
      .then(() => {
        Aria2cRemoteRetryTime = 0
        SetAriaOnline(true, 'remote')
      })
      .catch(() => {
        Aria2cRemoteRetryTime++
        SetAriaOnline(false, 'remote')
      })

    if (!IsAria2cOnlineRemote) {
      const url = host + ':' + port + ' secret=' + secret
      if (!settingStore.AriaIsLocal && Aria2cRemoteRetryTime % 10 == 1) message.error('无法连接到远程Aria2 ' + url)
    } else {
      const limit = settingStore.downGlobalSpeed.toString() + (settingStore.downGlobalSpeedM == 'MB' ? 'M' : 'K')
      await Aria2EngineRemote.call('aria2.changeGlobalOption', { 'max-overall-download-limit': limit }).catch((e: any) => {
        if (e && e.message == 'Unauthorized') message.error('Aria2密码错误(密码不要有 ^ 或特殊字符)')
        IsAria2cOnlineRemote = false
      })
    }
  } catch (e) {
    SetAriaOnline(false, 'remote')
  }
  Aria2cChangeing = false
  return IsAria2cOnlineRemote
}


export async function AriaChangeToLocal() {
  CloseRemote()
  try {
    if (Aria2EngineLocal == undefined) {
      const port = window.WebRelaunchAria ? await window.WebRelaunchAria() : 16800
      const options = { host: '127.0.0.1', port, secure: false, secret: localPwd, path: '/jsonrpc' }
      Aria2EngineLocal = new Aria2({ WebSocket: global.WebSocket, fetch: global.fetch, ...options })
      Aria2EngineLocal.on('close', () => {
        IsAria2cOnlineLocal = false
        if (useSettingStore().AriaIsLocal) {
          message.error('Aria2本地连接已断开')
          let doc = document.getElementById('footAria')
          if (doc && doc.innerText != 'Aria 已断开') doc.innerText = 'Aria 已断开'
        }
      })
    }

    await Aria2EngineLocal.open()
      .then(() => {
        Aria2cLocalRelanchTime = 0
        SetAriaOnline(true, 'local')
      })
      .catch(() => {
        SetAriaOnline(false, 'local')
        Aria2cLocalRelanchTime++
        if (Aria2cLocalRelanchTime < 2) {
          message.info('正在尝试重启Aria进程中。。。')
        }
      })

    if (!IsAria2cOnlineLocal) {
      const url = '127.0.0.1:16800 secret=' + localPwd
      if (Aria2cLocalRelanchTime < 2) message.error('无法连接到本地Aria2 ' + url)
    } else {
      const settingStore = useSettingStore()
      const limit = settingStore.downGlobalSpeed.toString() + (settingStore.downGlobalSpeedM == 'MB' ? 'M' : 'K')
      await Aria2EngineLocal.call('aria2.changeGlobalOption', { 'max-overall-download-limit': limit }).catch((e: any) => {
        if (e && e.message == 'Unauthorized') message.error('Aria2密码错误(密码不要有 ^ 或特殊字符)')
        IsAria2cOnlineLocal = false
      })
    }
    await Sleep(1000)
  } catch (e) {
    SetAriaOnline(false, 'local')
  }
  return true
}


export async function AriaGlobalSpeed() {
  try {
    const settingStore = useSettingStore()
    const limit = settingStore.downGlobalSpeed.toString() + (settingStore.downGlobalSpeedM == 'MB' ? 'M' : 'K')
    await GetAria()?.call('aria2.changeGlobalOption', { 'max-overall-download-limit': limit })
  } catch {
    SetAriaOnline(false)
  }
}

export async function AriaConnect() {
  if (useSettingStore().AriaIsLocal) {
    if (!IsAria2cOnlineLocal) await AriaChangeToLocal()
    return IsAria2cOnlineLocal
  } else {
    if (!IsAria2cOnlineRemote) await AriaChangeToRemote()
    return IsAria2cOnlineRemote
  }
}


export async function AriaGetDowningList() {
  const multicall = [
    ['aria2.tellActive', ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'errorCode', 'errorMessage']],
    ['aria2.tellWaiting', 0, 1000, ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'errorCode', 'errorMessage']],
    ['aria2.tellStopped', 0, 1000, ['gid', 'status', 'totalLength', 'completedLength', 'downloadSpeed', 'errorCode', 'errorMessage']]
  ]
  try {
    const result: any = await GetAria()?.multicall(multicall)
    if (result) {
      let list: IAriaDownProgress[] = []
      let arr = result[0][0]
      list = list.concat(arr)
      arr = result[1][0]
      list = list.concat(arr)
      arr = result[2][0]
      list = list.concat(arr)
      DownDAL.mSpeedEvent(list)
      SetAriaOnline(true)
    }
  } catch (e: any) {
    DebugLog.mSaveLog('danger', 'AriaGetDowningList' + (e.message || ''), e)
    SetAriaOnline(false)
  }
}


export async function AriaDeleteList(list: string[]) {
  const multicall = []
  for (let i = 0, maxi = list.length; i < maxi; i++) {
    multicall.push(['aria2.forceRemove', list[i]])
    multicall.push(['aria2.removeDownloadResult', list[i]])
  }
  try {
    await GetAria()?.multicall(multicall)
    SetAriaOnline(true)
  } catch {
    SetAriaOnline(false)
  }
}


export async function AriaStopList(list: string[]) {
  const multicall = []
  for (let i = 0, maxi = list.length; i < maxi; i++) {
    multicall.push(['aria2.forcePause', list[i]])
  }
  try {
    await GetAria()?.multicall(multicall)
    SetAriaOnline(true)
  } catch {
    SetAriaOnline(false)
  }
}


export function AriaShoutDown() {
  if (useSettingStore().AriaIsLocal) {
    Aria2EngineLocal?.call('aria2.forceShutdown').catch((e: any) => {})
  }
}


export async function AriaAddUrl(file: IStateDownFile): Promise<string> {
  try {
    const info = file.Info
    const token = UserDAL.GetUserToken(info.user_id)
    if (!token || !token.access_token) return '账号失效，操作取消'
    if (info.isDir) {

      const dirfull = path.join(info.DownSavePath, info.name)
      if (!info.ariaRemote) {

        await fsPromises.mkdir(dirfull, { recursive: true }).catch((e: any) => {
          if (e.code && e.code === 'EPERM') e = '没有权限'
          if (e.code && e.code === 'EBUSY') e = '文件夹被占用或锁定中'
          if (e.message) e = e.message
          if (typeof e == 'string' && e.indexOf('EACCES') >= 0) e = '没有权限'
          DebugLog.mSaveLog('danger', 'AriaAddUrl创建文件夹失败：' + dirfull + ' ' + (e || ''), e)
          return undefined
        })
      }

      const dir: IAliFileResp = {
        items: [],
        itemsKey:new Set(),
        punished_file_count: 0,
        next_marker: '',
        m_user_id: info.user_id,
        m_drive_id: info.drive_id,
        dirID: info.file_id,
        dirName: info.name
      }
      do {
        const isGet = await AliTrash.ApiFileListOnePageAria('name', 'ASC', dir)
        if (!isGet) {
          return '解析子文件列表失败，稍后重试'
        } else {
          if (file.Down.IsStop) {
            dir.items.length = 0
            return '已暂停'
          }
          if (dir.items.length > 0) DownDAL.aAddDownload(dir.items, dirfull, false, false)
          dir.items.length = 0
        }
      } while (dir.next_marker)

      return 'downed'
    } else {

      const dir = info.DownSavePath
      const out = info.ariaRemote ? info.name : info.name + '.td'
      const filefull = path.join(dir, info.name)
      if (!info.ariaRemote) {
        try {
          const finfo = await fsPromises.stat(filefull)
          if (finfo && finfo.size == info.size) return 'downed'
          else return '本地存在重名文件，请手动删除'
        } catch (e: any) {
          if (e.code && e.code === 'EPERM') e = '文件没有读取权限'
          if (e.code && e.code === 'EBUSY') e = '文件被占用或锁定中'
          if (e.message) e = e.message
          if (typeof e == 'string' && e.indexOf('EACCES') >= 0) e = '文件没有读取权限'
          if (typeof e == 'string' && e.indexOf('no such file') >= 0) {

          } else {
            DebugLog.mSaveLog('danger', 'AriaAddUrl访问文件失败：' + filefull + ' ' + (e || ''), e)
            return e
          }
        }

        if (info.size == 0) {
          try {

            await (await fsPromises.open(filefull, 'w')).close().catch((e: any) => {
              return undefined
            })
            return 'downed'
          } catch {
            return '创建空文件失败'
          }
        }
      }


      let downurl = file.Down.DownUrl

      if (downurl != '' && downurl.indexOf('x-oss-expires=') > 0) {

        let expires = downurl.substr(downurl.indexOf('x-oss-expires=') + 'x-oss-expires='.length)
        expires = expires.substr(0, expires.indexOf('&'))
        const lasttime = parseInt(expires) - Date.now() / 1000
        const needtime = (info.size + 1) / 1024 / 1024
        if (lasttime < 60 || lasttime < needtime + 60) downurl = ''
      } else downurl = ''

      if (!downurl) {
        const durl = await AliFile.ApiFileDownloadUrl(info.user_id, info.drive_id, info.file_id, 14400)
        if (typeof durl == 'string') return '生成下载链接失败,' + durl
        else if (!durl.url) {
          DebugLog.mSaveLog('danger', info.file_id + '生成下载链接失败,' + JSON.stringify(durl), null)
          return '生成下载链接失败,' + JSON.stringify(durl)
        }
        downurl = durl.url
        file.Down.DownUrl = downurl
      }
      if (!downurl) return '生成下载链接失败0'
      if (file.Down.IsStop) return '已暂停'

      const split = useSettingStore().downThreadMax
      const referer = Config.referer
      const userAgent = Config.userAgent
      const multicall = [
        ['aria2.forceRemove', info.GID],
        ['aria2.removeDownloadResult', info.GID],
        ['aria2.addUri', [downurl], { gid: info.GID, dir, out, split, referer, 'user-agent': userAgent, 'check-certificate': 'false', 'file-allocation': 'trunc' }]
      ]
      const result: any = await GetAria()?.multicall(multicall)
      if (result == undefined || result.length < 3 || (result[2].code != undefined && result[2].code) != 0) return '创建aria任务失败，稍后自动重试' + result[2].message
      if (result[2].length == 1) return 'success'
    }
  } catch (e: any) {
    SetAriaOnline(false)
    DebugLog.mSaveLog('danger', 'AriaAddUrl' + (e.message || ''), e)
    return Promise.resolve('创建Aria任务失败连接断开')
  }
  return Promise.resolve('创建Aria任务失败1')
}


export function AriaHashFile(downitem: IStateDownFile): { DownID: string; Check: boolean } {
  const DownID = downitem.DownID
  const dir = downitem.Info.DownSavePath
  const out = downitem.Info.ariaRemote ? downitem.Info.name : downitem.Info.name + '.td'
  const sha1 = downitem.Info.sha1
  const crc64 = downitem.Info.crc64

  const data = {
    DownID: DownID,
    inputfile: path.join(dir, out),
    movetofile: path.join(dir, downitem.Info.name),
    hash: crc64 ? 'crc64' : sha1 ? 'sha1' : '',
    check: crc64 || sha1 || ''
  }
  let success = false
  if (data.inputfile == data.movetofile) {
    success = true
  } else {
    try {
      fs.renameSync(data.inputfile, data.movetofile)
      success = true
    } catch {
      try {
        fs.renameSync(data.inputfile, data.movetofile)
        success = true
      } catch (e: any) {
        DebugLog.mSaveLog('danger', 'AriaRename file=' + data.inputfile + ' error=' + (e.message || ''), e)
      }
    }
  }
  return { DownID, Check: success }
}


export function FormateAriaError(code: string, message: string): string {
  switch (code) {
    case '0':
      return ''
    case '1':
      return 'aria2c未知错误'
    case '2':
      return 'aria2c网络超时'
    case '3':
      return 'aria2c网络文件404'
    case '4':
      return 'aria2c网络文件404'
    case '5':
      return 'aria2c下载缓慢自动退出'
    case '6':
      return 'aria2c发生网络中断'
    case '7':
      return 'aria2c被强制退出错误'
    case '8':
      return 'aria2c服务器不支持断点续传'
    case '9':
      return 'aria2c本地硬盘空间不足'
    case '10':
      return 'aria2c分片大小更改'
    case '11':
      return 'aria2c重复任务'
    case '12':
      return 'aria2c重复BT任务'
    case '13':
      return 'aria2c文件已存在且不能覆盖'
    case '14':
      return 'aria2c文件重命名失败'
    case '15':
      return 'aria2c打开文件失败'
    case '16':
      return 'aria2c创建文件时失败'
    case '17':
      return 'aria2c文件写入失败'
    case '18':
      return 'aria2c创建文件夹失败'
    case '19':
      return 'aria2cDNS解析失败'
    case '20':
      return 'aria2c解析磁力失败'
    case '21':
      return 'aria2cFTP不支持的命令'
    case '22':
      if (message.includes('403')) return '服务器拒绝访问403'
      if (message.includes('503')) return '服务器返回错误503'
      return message
    case '23':
      return 'aria2cHTTP重定向失败'
    case '24':
      return 'aria2cHTTP认证失败'
    case '25':
      return 'aria2c格式化种子失败'
    case '26':
      return 'aria2c读取种子信息失败'
    case '27':
      return 'aria2c磁力链接错误'
    case '28':
      return 'aria2c提供了错误的参数'
    case '29':
      return 'aria2c服务器超载暂时无法处理请求'
    case '30':
      return 'aria2cRPC传输参数错误'
    case '31':
      return 'aria2c多余的响应数据'
    case '32':
      return 'aria2c文件sha1校验失败'
    default:
      return message
  }
}
